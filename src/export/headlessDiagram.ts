import * as dagre from '@dagrejs/dagre'
import type { KettleEdge, KettleGraph, KettleNode, KettleNote } from '../model/graph'

export type LayoutCollisionKind = 'node-node' | 'edge-node' | 'edge-edge' | 'note-node'

export interface LayoutCollision {
  kind: LayoutCollisionKind
  severity: 'error' | 'warning'
  first: string
  second: string
  detail: string
}

export interface HeadlessLayoutReport {
  status: 'PASS' | 'FAIL'
  graph: {
    kind: KettleGraph['kind']
    name: string
    nodes: number
    enabledEdges: number
    notes: number
  }
  source: {
    basename?: string
    sha256?: string
  }
  renderer: {
    mode: 'spoon-coordinates-diagnostic' | 'dagre-suggested-diagnostic'
    nodeWidth: number
    iconSize: number
    minimumNodeGap: number
    edgeClearance: number
    spoonCoordinatesPreserved: boolean
  }
  bounds: Rect
  collisionCounts: Record<LayoutCollisionKind, number>
  blockingCollisionCount: number
  warningCollisionCount: number
  collisions: LayoutCollision[]
  sensitiveStepConfigurationIncluded: false
}

export interface HeadlessDiagramOptions {
  sourceBasename?: string
  sourceSha256?: string
  viewport?: Rect
  layout?: 'spoon' | 'dagre'
}

export interface HeadlessDiagramResult {
  svg: string
  report: HeadlessLayoutReport
  width: number
  height: number
  positions: SuggestedStepPosition[]
}

export interface SuggestedStepPosition {
  id: string
  name: string
  x: number
  y: number
}

export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

interface Point {
  x: number
  y: number
}

interface Segment {
  start: Point
  end: Point
}

interface RenderNode {
  source: KettleNode
  icon: Rect
  footprint: Rect
  labelLines: string[]
}

interface RenderEdge {
  source: KettleEdge
  fromName: string
  toName: string
  points: Point[]
  segments: Segment[]
}

const ICON_SIZE = 34
const NODE_WIDTH = 220
const LABEL_FONT_SIZE = 11
const LABEL_LINE_HEIGHT = 14
const LABEL_MAX_CHARS = 28
const LABEL_MAX_LINES = 4
const MINIMUM_NODE_GAP = 20
const EDGE_CLEARANCE = 10
const NOTE_PADDING = 8
const EXPORT_PADDING = 72
const HEADER_HEIGHT = 48
const DAGRE_NODE_SEPARATION = 96
const DAGRE_RANK_SEPARATION = 180
const DAGRE_MARGIN = 128
const SPOON_GRID = 16

function round(value: number): number {
  return Math.round(value * 100) / 100
}

function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
}

function wrapText(value: string, maxChars = LABEL_MAX_CHARS, maxLines = LABEL_MAX_LINES): string[] {
  const normalized = value.trim().replace(/\s+/g, ' ')
  if (!normalized) return ['(sin nombre)']

  const words = normalized.split(' ')
  const lines: string[] = []
  let current = ''

  for (const word of words) {
    if (word.length > maxChars) {
      if (current) {
        lines.push(current)
        current = ''
      }
      let remaining = word
      while (remaining.length > maxChars && lines.length < maxLines) {
        lines.push(remaining.slice(0, maxChars))
        remaining = remaining.slice(maxChars)
      }
      current = remaining
      continue
    }

    const candidate = current ? `${current} ${word}` : word
    if (candidate.length <= maxChars) {
      current = candidate
    } else {
      lines.push(current)
      current = word
    }

    if (lines.length >= maxLines) break
  }

  if (lines.length < maxLines && current) lines.push(current)
  if (lines.length === 0) lines.push(normalized.slice(0, maxChars))

  const consumed = lines.join(' ').replace(/\s+/g, '')
  const original = normalized.replace(/\s+/g, '')
  if (consumed.length < original.length) {
    const lastIndex = Math.min(lines.length, maxLines) - 1
    const last = lines[lastIndex] ?? ''
    lines[lastIndex] = `${last.slice(0, Math.max(1, maxChars - 3))}...`
  }

  return lines.slice(0, maxLines)
}

function normalizeRect(rect: Rect): Rect {
  return {
    x: round(rect.x),
    y: round(rect.y),
    width: round(Math.max(1, rect.width)),
    height: round(Math.max(1, rect.height)),
  }
}

function expandRect(rect: Rect, amount: number): Rect {
  return {
    x: rect.x - amount,
    y: rect.y - amount,
    width: rect.width + amount * 2,
    height: rect.height + amount * 2,
  }
}

function rectsOverlap(first: Rect, second: Rect): boolean {
  return (
    first.x < second.x + second.width
    && first.x + first.width > second.x
    && first.y < second.y + second.height
    && first.y + first.height > second.y
  )
}

function pointEquals(first: Point, second: Point): boolean {
  return first.x === second.x && first.y === second.y
}

function segmentsFor(points: Point[]): Segment[] {
  const result: Segment[] = []
  for (let index = 1; index < points.length; index += 1) {
    const start = points[index - 1]
    const end = points[index]
    if (!pointEquals(start, end)) result.push({ start, end })
  }
  return result
}

function segmentIntersectsRect(segment: Segment, rect: Rect): boolean {
  const left = rect.x
  const right = rect.x + rect.width
  const top = rect.y
  const bottom = rect.y + rect.height

  if (segment.start.y === segment.end.y) {
    const y = segment.start.y
    const minX = Math.min(segment.start.x, segment.end.x)
    const maxX = Math.max(segment.start.x, segment.end.x)
    return y >= top && y <= bottom && maxX >= left && minX <= right
  }

  if (segment.start.x === segment.end.x) {
    const x = segment.start.x
    const minY = Math.min(segment.start.y, segment.end.y)
    const maxY = Math.max(segment.start.y, segment.end.y)
    return x >= left && x <= right && maxY >= top && minY <= bottom
  }

  return false
}

function axisAlignedSegmentsIntersect(first: Segment, second: Segment): boolean {
  const firstHorizontal = first.start.y === first.end.y
  const secondHorizontal = second.start.y === second.end.y

  if (firstHorizontal && secondHorizontal) {
    if (first.start.y !== second.start.y) return false
    const firstMin = Math.min(first.start.x, first.end.x)
    const firstMax = Math.max(first.start.x, first.end.x)
    const secondMin = Math.min(second.start.x, second.end.x)
    const secondMax = Math.max(second.start.x, second.end.x)
    return Math.min(firstMax, secondMax) > Math.max(firstMin, secondMin)
  }

  if (!firstHorizontal && !secondHorizontal) {
    if (first.start.x !== second.start.x) return false
    const firstMin = Math.min(first.start.y, first.end.y)
    const firstMax = Math.max(first.start.y, first.end.y)
    const secondMin = Math.min(second.start.y, second.end.y)
    const secondMax = Math.max(second.start.y, second.end.y)
    return Math.min(firstMax, secondMax) > Math.max(firstMin, secondMin)
  }

  const horizontal = firstHorizontal ? first : second
  const vertical = firstHorizontal ? second : first
  const horizontalMin = Math.min(horizontal.start.x, horizontal.end.x)
  const horizontalMax = Math.max(horizontal.start.x, horizontal.end.x)
  const verticalMin = Math.min(vertical.start.y, vertical.end.y)
  const verticalMax = Math.max(vertical.start.y, vertical.end.y)

  return (
    vertical.start.x > horizontalMin
    && vertical.start.x < horizontalMax
    && horizontal.start.y > verticalMin
    && horizontal.start.y < verticalMax
  )
}

function nodeGeometry(node: KettleNode): RenderNode {
  const x = typeof node.x === 'number' ? node.x : 0
  const y = typeof node.y === 'number' ? node.y : 0
  const labelLines = wrapText(node.name)
  const footprintHeight = ICON_SIZE + 8 + labelLines.length * LABEL_LINE_HEIGHT + 10
  const icon = normalizeRect({ x, y, width: ICON_SIZE, height: ICON_SIZE })
  const footprint = normalizeRect({
    x: x + ICON_SIZE / 2 - NODE_WIDTH / 2,
    y,
    width: NODE_WIDTH,
    height: footprintHeight,
  })
  return { source: node, icon, footprint, labelLines }
}

function snapToGrid(value: number): number {
  return Math.round(value / SPOON_GRID) * SPOON_GRID
}

export function suggestDagrePositions(graph: KettleGraph): SuggestedStepPosition[] {
  const layout = new dagre.graphlib.Graph()
  layout.setGraph({
    rankdir: 'LR',
    nodesep: DAGRE_NODE_SEPARATION,
    ranksep: DAGRE_RANK_SEPARATION,
    edgesep: 44,
    marginx: DAGRE_MARGIN,
    marginy: DAGRE_MARGIN,
    acyclicer: 'greedy',
    ranker: 'network-simplex',
  })
  layout.setDefaultEdgeLabel(() => ({}))

  const heights = new Map<string, number>()
  for (const node of graph.nodes) {
    const geometry = nodeGeometry({ ...node, x: 0, y: 0 })
    heights.set(node.id, geometry.footprint.height)
    layout.setNode(node.id, {
      width: NODE_WIDTH,
      height: geometry.footprint.height,
    })
  }
  for (const edge of graph.edges.filter((item) => item.enabled)) {
    layout.setEdge(edge.from, edge.to)
  }

  dagre.layout(layout)
  const raw = graph.nodes.map((node) => {
    const position = layout.node(node.id) as { x: number; y: number } | undefined
    if (!position) throw new Error(`Dagre no produjo coordenadas para ${node.name}.`)
    const height = heights.get(node.id) ?? ICON_SIZE
    return {
      id: node.id,
      name: node.name,
      x: snapToGrid(position.x - ICON_SIZE / 2),
      y: snapToGrid(position.y - height / 2),
    }
  })

  const preliminaryGraph: KettleGraph = {
    ...graph,
    nodes: graph.nodes.map((node) => {
      const position = raw.find((item) => item.id === node.id)
      return position ? { ...node, x: position.x, y: position.y } : node
    }),
  }
  const preliminary = preliminaryGraph.nodes.map(nodeGeometry)
  const minimumX = Math.min(...preliminary.map((node) => node.footprint.x))
  const minimumY = Math.min(...preliminary.map((node) => node.footprint.y))
  const shiftX = snapToGrid(Math.max(0, DAGRE_MARGIN - minimumX))
  const shiftY = snapToGrid(Math.max(0, DAGRE_MARGIN - minimumY))

  return raw.map((position) => ({
    ...position,
    x: position.x + shiftX,
    y: position.y + shiftY,
  }))
}

function graphWithPositions(graph: KettleGraph, positions: SuggestedStepPosition[]): KettleGraph {
  const byId = new Map(positions.map((position) => [position.id, position]))
  return {
    ...graph,
    nodes: graph.nodes.map((node) => {
      const position = byId.get(node.id)
      return position ? { ...node, x: position.x, y: position.y } : node
    }),
  }
}

function iconCenter(node: RenderNode): Point {
  return {
    x: node.icon.x + node.icon.width / 2,
    y: node.icon.y + node.icon.height / 2,
  }
}

function edgeEndpoints(source: RenderNode, target: RenderNode): { start: Point; end: Point } {
  const sourceCenter = iconCenter(source)
  const targetCenter = iconCenter(target)
  const dx = targetCenter.x - sourceCenter.x
  const dy = targetCenter.y - sourceCenter.y

  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx >= 0
      ? {
          start: { x: source.icon.x + source.icon.width, y: sourceCenter.y },
          end: { x: target.icon.x, y: targetCenter.y },
        }
      : {
          start: { x: source.icon.x, y: sourceCenter.y },
          end: { x: target.icon.x + target.icon.width, y: targetCenter.y },
        }
  }

  return dy >= 0
    ? {
        start: { x: sourceCenter.x, y: source.icon.y + source.icon.height },
        end: { x: targetCenter.x, y: target.icon.y },
      }
    : {
        start: { x: sourceCenter.x, y: source.icon.y },
        end: { x: targetCenter.x, y: target.icon.y + target.icon.height },
      }
}

function routeEdge(source: RenderNode, target: RenderNode): Point[] {
  const { start, end } = edgeEndpoints(source, target)
  const dx = end.x - start.x
  const dy = end.y - start.y

  if (Math.abs(dx) >= Math.abs(dy)) {
    const midX = round(start.x + dx / 2)
    return [start, { x: midX, y: start.y }, { x: midX, y: end.y }, end]
  }

  const midY = round(start.y + dy / 2)
  return [start, { x: start.x, y: midY }, { x: end.x, y: midY }, end]
}

function edgeGeometry(edge: KettleEdge, byId: Map<string, RenderNode>): RenderEdge {
  const source = byId.get(edge.from)
  const target = byId.get(edge.to)
  if (!source || !target) {
    throw new Error(`El hop ${edge.id} referencia un nodo inexistente.`)
  }
  const points = routeEdge(source, target)
  return {
    source: edge,
    fromName: source.source.name,
    toName: target.source.name,
    points,
    segments: segmentsFor(points),
  }
}

function noteRect(note: KettleNote): Rect {
  return normalizeRect({ x: note.x, y: note.y, width: note.width, height: note.height })
}

function boundsOf(rectangles: Rect[], points: Point[]): Rect {
  const xs = rectangles.flatMap((rect) => [rect.x, rect.x + rect.width])
  const ys = rectangles.flatMap((rect) => [rect.y, rect.y + rect.height])
  xs.push(...points.map((point) => point.x))
  ys.push(...points.map((point) => point.y))
  if (xs.length === 0 || ys.length === 0) return { x: 0, y: 0, width: 1, height: 1 }

  const minX = Math.min(...xs) - EXPORT_PADDING
  const minY = Math.min(...ys) - EXPORT_PADDING - HEADER_HEIGHT
  const maxX = Math.max(...xs) + EXPORT_PADDING
  const maxY = Math.max(...ys) + EXPORT_PADDING
  return normalizeRect({ x: minX, y: minY, width: maxX - minX, height: maxY - minY })
}

function analyzeCollisions(nodes: RenderNode[], edges: RenderEdge[], notes: KettleNote[]): LayoutCollision[] {
  const collisions: LayoutCollision[] = []

  for (let firstIndex = 0; firstIndex < nodes.length; firstIndex += 1) {
    const first = nodes[firstIndex]
    for (let secondIndex = firstIndex + 1; secondIndex < nodes.length; secondIndex += 1) {
      const second = nodes[secondIndex]
      if (rectsOverlap(expandRect(first.footprint, MINIMUM_NODE_GAP / 2), expandRect(second.footprint, MINIMUM_NODE_GAP / 2))) {
        collisions.push({
          kind: 'node-node',
          severity: 'error',
          first: first.source.name,
          second: second.source.name,
          detail: `Las huellas visuales no conservan ${MINIMUM_NODE_GAP}px de separación.`,
        })
      }
    }
  }

  for (const edge of edges) {
    for (const node of nodes) {
      if (node.source.id === edge.source.from || node.source.id === edge.source.to) continue
      if (edge.segments.some((segment) => segmentIntersectsRect(segment, expandRect(node.footprint, EDGE_CLEARANCE)))) {
        collisions.push({
          kind: 'edge-node',
          severity: 'error',
          first: `${edge.fromName} -> ${edge.toName}`,
          second: node.source.name,
          detail: `El hop entra en la huella del nodo o su etiqueta (clearance ${EDGE_CLEARANCE}px).`,
        })
      }
    }
  }

  for (let firstIndex = 0; firstIndex < edges.length; firstIndex += 1) {
    const first = edges[firstIndex]
    for (let secondIndex = firstIndex + 1; secondIndex < edges.length; secondIndex += 1) {
      const second = edges[secondIndex]
      const sharedNode = (
        first.source.from === second.source.from
        || first.source.from === second.source.to
        || first.source.to === second.source.from
        || first.source.to === second.source.to
      )
      if (sharedNode) continue
      if (first.segments.some((firstSegment) => second.segments.some((secondSegment) => axisAlignedSegmentsIntersect(firstSegment, secondSegment)))) {
        collisions.push({
          kind: 'edge-edge',
          severity: 'warning',
          first: `${first.fromName} -> ${first.toName}`,
          second: `${second.fromName} -> ${second.toName}`,
          detail: 'Los hops diagnósticos se cruzan fuera de sus nodos extremos.',
        })
      }
    }
  }

  for (const note of notes) {
    const expandedNote = expandRect(noteRect(note), NOTE_PADDING)
    for (const node of nodes) {
      if (rectsOverlap(expandedNote, node.footprint)) {
        collisions.push({
          kind: 'note-node',
          severity: 'warning',
          first: note.text.trim().replace(/\s+/g, ' ').slice(0, 80) || note.id,
          second: node.source.name,
          detail: `La nota queda a menos de ${NOTE_PADDING}px de la huella del nodo.`,
        })
      }
    }
  }

  return collisions.sort((first, second) => (
    first.kind.localeCompare(second.kind)
    || first.first.localeCompare(second.first)
    || first.second.localeCompare(second.second)
  ))
}

function pathData(points: Point[]): string {
  return points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${round(point.x)} ${round(point.y)}`).join(' ')
}

function midpoint(points: Point[]): Point {
  const segments = segmentsFor(points)
  const lengths = segments.map((segment) => Math.abs(segment.end.x - segment.start.x) + Math.abs(segment.end.y - segment.start.y))
  const total = lengths.reduce((sum, value) => sum + value, 0)
  let remaining = total / 2

  for (let index = 0; index < segments.length; index += 1) {
    const segment = segments[index]
    const length = lengths[index]
    if (remaining <= length) {
      const ratio = length === 0 ? 0 : remaining / length
      return {
        x: round(segment.start.x + (segment.end.x - segment.start.x) * ratio),
        y: round(segment.start.y + (segment.end.y - segment.start.y) * ratio),
      }
    }
    remaining -= length
  }

  return points[points.length - 1] ?? { x: 0, y: 0 }
}

function renderNote(note: KettleNote): string {
  const rect = noteRect(note)
  const lines = wrapText(note.text, 42, 8)
  const fontSize = Math.max(9, Math.min(18, note.fontSize ?? 11))
  const background = note.backgroundColor ?? '#fff8c5'
  const border = note.borderColor ?? '#a78b22'
  const textColor = note.fontColor ?? '#3f3a16'
  const tspans = lines.map((line, index) => (
    `<tspan x="${round(rect.x + 10)}" dy="${index === 0 ? 0 : fontSize + 3}">${escapeXml(line)}</tspan>`
  )).join('')
  return [
    `<g class="note" data-note-id="${escapeXml(note.id)}">`,
    `<rect x="${rect.x}" y="${rect.y}" width="${rect.width}" height="${rect.height}" rx="4" fill="${escapeXml(background)}" stroke="${escapeXml(border)}"/>`,
    `<text x="${round(rect.x + 10)}" y="${round(rect.y + fontSize + 8)}" font-size="${fontSize}" fill="${escapeXml(textColor)}">${tspans}</text>`,
    '</g>',
  ].join('')
}

function renderEdge(edge: RenderEdge): string {
  const isError = edge.source.errorHandler === true
  const isDisabled = !edge.source.enabled
  const stroke = isError ? '#b91c1c' : isDisabled ? '#8b1d1d' : '#315f7d'
  const marker = isError || isDisabled ? 'arrow-red' : 'arrow-blue'
  const dash = isDisabled ? ' stroke-dasharray="7 5"' : ''
  const width = isError ? 2.4 : 1.5
  const label = edge.source.filterResult
  const labelPoint = midpoint(edge.points)
  const labelColor = label === 'true' ? '#166534' : '#991b1b'
  const labelBackground = label === 'true' ? '#dcfce7' : '#fee2e2'
  const labelSvg = label
    ? `<g class="filter-label"><rect x="${round(labelPoint.x - 24)}" y="${round(labelPoint.y - 11)}" width="48" height="22" rx="5" fill="${labelBackground}" stroke="${labelColor}"/><text x="${labelPoint.x}" y="${round(labelPoint.y + 4)}" text-anchor="middle" font-size="10" font-weight="700" fill="${labelColor}">${label.toUpperCase()}</text></g>`
    : ''

  return [
    `<g class="edge" data-edge-id="${escapeXml(edge.source.id)}">`,
    `<title>${escapeXml(`${edge.fromName} -> ${edge.toName}`)}</title>`,
    `<path d="${pathData(edge.points)}" fill="none" stroke="${stroke}" stroke-width="${width}" marker-end="url(#${marker})"${dash}/>`,
    labelSvg,
    '</g>',
  ].join('')
}

function renderNode(node: RenderNode, collided: boolean): string {
  const centerX = round(node.icon.x + node.icon.width / 2)
  const labelTop = round(node.icon.y + node.icon.height + 6)
  const labelHeight = round(node.labelLines.length * LABEL_LINE_HEIGHT + 8)
  const labelX = round(node.footprint.x + 4)
  const labelWidth = round(node.footprint.width - 8)
  const typeLabel = node.source.type.replace(/[^a-z0-9]/gi, '').slice(0, 4).toUpperCase() || 'STEP'
  const tspans = node.labelLines.map((line, index) => (
    `<tspan x="${centerX}" dy="${index === 0 ? 0 : LABEL_LINE_HEIGHT}">${escapeXml(line)}</tspan>`
  )).join('')
  const collisionStroke = collided ? '#dc2626' : '#64748b'
  const collisionFill = collided ? '#fff1f2' : '#ffffff'

  return [
    `<g class="step" data-node-id="${escapeXml(node.source.id)}">`,
    `<title>${escapeXml(`${node.source.name} [${node.source.type}]`)}</title>`,
    `<rect x="${labelX}" y="${labelTop}" width="${labelWidth}" height="${labelHeight}" rx="5" fill="${collisionFill}" stroke="${collisionStroke}" stroke-width="${collided ? 2 : 1}"/>`,
    `<rect x="${node.icon.x}" y="${node.icon.y}" width="${node.icon.width}" height="${node.icon.height}" rx="4" fill="#f8fbff" stroke="${collisionStroke}" stroke-width="${collided ? 2 : 1.2}"/>`,
    `<text x="${centerX}" y="${round(node.icon.y + 21)}" text-anchor="middle" font-size="8" font-weight="700" fill="#1e3a5f">${escapeXml(typeLabel)}</text>`,
    `<text x="${centerX}" y="${round(labelTop + LABEL_FONT_SIZE + 1)}" text-anchor="middle" font-size="${LABEL_FONT_SIZE}" fill="#172033">${tspans}</text>`,
    '</g>',
  ].join('')
}

export function renderHeadlessDiagram(graph: KettleGraph, options: HeadlessDiagramOptions = {}): HeadlessDiagramResult {
  const layoutMode = options.layout ?? 'spoon'
  const positions = layoutMode === 'dagre'
    ? suggestDagrePositions(graph)
    : graph.nodes.map((node) => ({
        id: node.id,
        name: node.name,
        x: typeof node.x === 'number' ? node.x : 0,
        y: typeof node.y === 'number' ? node.y : 0,
      }))
  const positionedGraph = graphWithPositions(graph, positions)
  const nodes = positionedGraph.nodes.map(nodeGeometry)
  const byId = new Map(nodes.map((node) => [node.source.id, node]))
  const edges = positionedGraph.edges.filter((edge) => edge.enabled).map((edge) => edgeGeometry(edge, byId))
  const collisions = analyzeCollisions(nodes, edges, positionedGraph.notes)
  const blocking = collisions.filter((collision) => collision.severity === 'error')
  const warnings = collisions.filter((collision) => collision.severity === 'warning')
  const allRectangles = [...nodes.map((node) => node.footprint), ...positionedGraph.notes.map(noteRect)]
  const allPoints = edges.flatMap((edge) => edge.points)
  const calculatedBounds = boundsOf(allRectangles, allPoints)
  const bounds = normalizeRect(options.viewport ?? calculatedBounds)
  const collisionCounts: Record<LayoutCollisionKind, number> = {
    'node-node': collisions.filter((collision) => collision.kind === 'node-node').length,
    'edge-node': collisions.filter((collision) => collision.kind === 'edge-node').length,
    'edge-edge': collisions.filter((collision) => collision.kind === 'edge-edge').length,
    'note-node': collisions.filter((collision) => collision.kind === 'note-node').length,
  }
  const report: HeadlessLayoutReport = {
    status: blocking.length === 0 ? 'PASS' : 'FAIL',
    graph: {
      kind: positionedGraph.kind,
      name: positionedGraph.name,
      nodes: positionedGraph.nodes.length,
      enabledEdges: edges.length,
      notes: positionedGraph.notes.length,
    },
    source: {
      ...(options.sourceBasename ? { basename: options.sourceBasename } : {}),
      ...(options.sourceSha256 ? { sha256: options.sourceSha256 } : {}),
    },
    renderer: {
      mode: layoutMode === 'dagre' ? 'dagre-suggested-diagnostic' : 'spoon-coordinates-diagnostic',
      nodeWidth: NODE_WIDTH,
      iconSize: ICON_SIZE,
      minimumNodeGap: MINIMUM_NODE_GAP,
      edgeClearance: EDGE_CLEARANCE,
      spoonCoordinatesPreserved: layoutMode === 'spoon'
        && graph.nodes.every((node) => typeof node.x === 'number' && typeof node.y === 'number'),
    },
    bounds,
    collisionCounts,
    blockingCollisionCount: blocking.length,
    warningCollisionCount: warnings.length,
    collisions,
    sensitiveStepConfigurationIncluded: false,
  }

  const collidedNodeNames = new Set(
    blocking
      .filter((collision) => collision.kind === 'node-node' || collision.kind === 'edge-node')
      .flatMap((collision) => [collision.first, collision.second]),
  )
  const headerX = round(bounds.x + 18)
  const headerY = round(bounds.y + 26)
  const statusColor = report.status === 'PASS' ? '#166534' : '#b91c1c'
  const svg = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.ceil(bounds.width)}" height="${Math.ceil(bounds.height)}" viewBox="${bounds.x} ${bounds.y} ${bounds.width} ${bounds.height}" role="img" aria-labelledby="diagram-title diagram-description">`,
    `<title id="diagram-title">${escapeXml(positionedGraph.name)} - diagnóstico de layout</title>`,
    `<desc id="diagram-description">${positionedGraph.nodes.length} nodos, ${edges.length} hops habilitados, ${blocking.length} colisiones bloqueantes.</desc>`,
    '<defs>',
    '<pattern id="grid" width="32" height="32" patternUnits="userSpaceOnUse"><path d="M 32 0 L 0 0 0 32" fill="none" stroke="#e7edf4" stroke-width="1"/></pattern>',
    '<marker id="arrow-blue" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="#315f7d"/></marker>',
    '<marker id="arrow-red" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="#b91c1c"/></marker>',
    '</defs>',
    `<rect x="${bounds.x}" y="${bounds.y}" width="${bounds.width}" height="${bounds.height}" fill="#ffffff"/>`,
    `<rect x="${bounds.x}" y="${bounds.y}" width="${bounds.width}" height="${bounds.height}" fill="url(#grid)"/>`,
    `<text x="${headerX}" y="${headerY}" font-size="18" font-weight="700" fill="#172033">${escapeXml(positionedGraph.name)}</text>`,
    `<text x="${headerX}" y="${round(headerY + 19)}" font-size="12" fill="${statusColor}">${report.status}: ${blocking.length} colisiones bloqueantes, ${warnings.length} advertencias</text>`,
    ...positionedGraph.notes.map(renderNote),
    ...edges.map(renderEdge),
    ...nodes.map((node) => renderNode(node, collidedNodeNames.has(node.source.name))),
    '</svg>',
    '',
  ].join('\n')

  return {
    svg,
    report,
    width: Math.ceil(bounds.width),
    height: Math.ceil(bounds.height),
    positions,
  }
}
