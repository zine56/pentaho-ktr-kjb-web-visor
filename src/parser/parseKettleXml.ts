import type { KettleEdge, KettleGraph, KettleKind, KettleNode } from '../model/graph'

export class KettleParseError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'KettleParseError'
  }
}

/** Returns the first direct child element of `el` whose local name is `tag`. */
function child(el: Element | null, tag: string): Element | null {
  if (!el) return null
  for (let i = 0; i < el.children.length; i += 1) {
    const c = el.children[i]
    if ((c.localName ?? c.nodeName) === tag) return c
  }
  return null
}

function textOf(el: Element | null, tag: string): string | undefined {
  const c = child(el, tag)
  const t = c?.textContent?.trim()
  return t === '' ? undefined : t
}

function parseBool(value: string | undefined): boolean {
  if (value === undefined) return true
  const v = value.trim().toUpperCase()
  return v === 'Y' || v === 'TRUE' || v === '1'
}

function parseXmlBool(el: Element | null, tag: string): boolean | undefined {
  if (!el) return undefined
  const node = child(el, tag)
  const nodeValue = node?.textContent?.trim()
  if (nodeValue) return parseBool(nodeValue)
  if (node) {
    const nodeAttr = node.getAttribute('value') ?? node.getAttribute('enabled') ?? node.getAttribute('error')
    if (nodeAttr !== null && nodeAttr !== '') return parseBool(nodeAttr)
  }
  const attrValue = el.getAttribute?.(tag)
  if (attrValue === null || attrValue === '') return undefined
  return parseBool(attrValue)
}

function parseXml(xml: string): Document {
  const doc = new DOMParser().parseFromString(xml, 'application/xml')
  const parserError = doc.getElementsByTagName('parsererror')[0]
  if (parserError) {
    throw new KettleParseError('Malformed XML: ' + (parserError.textContent ?? 'parse error').trim())
  }
  if (!doc.documentElement) {
    throw new KettleParseError('Malformed XML: no document element')
  }
  return doc
}

function detectKindFromRoot(root: Element, fileName?: string): KettleKind {
  const local = root.localName ?? root.nodeName
  if (local === 'transformation') return 'transformation'
  if (local === 'job') return 'job'
  const ext = fileName?.split('.').pop()?.toLowerCase()
  if (ext === 'ktr') return 'transformation'
  if (ext === 'kjb') return 'job'
  throw new KettleParseError(
    'Unrecognized Kettle file: expected a <transformation> (.ktr) or <job> (.kjb) root element.',
  )
}

/** Detect the Kettle file kind from its XML, with the filename extension as a secondary hint. */
export function detectKind(xml: string, fileName?: string): KettleKind {
  return detectKindFromRoot(parseXml(xml).documentElement, fileName)
}

interface RawNode {
  name: string
  type: string
  kind: 'step' | 'entry'
  configXml?: string
  x?: number
  y?: number
  draw?: boolean
}

function parseNumber(value: string | undefined): number | undefined {
  if (value === undefined || value.trim() === '') return undefined
  const n = Number(value)
  return Number.isFinite(n) ? n : undefined
}

function serializeNodeConfig(stepElement: Element): string | undefined {
  const parts: string[] = []
  const serializer = new XMLSerializer()

  for (let i = 0; i < stepElement.children.length; i += 1) {
    const childNode = stepElement.children[i]
    const tag = childNode.localName ?? childNode.nodeName
    if (tag === 'name' || tag === 'type' || tag === 'GUI') {
      continue
    }
    parts.push(serializer.serializeToString(childNode))
  }

  if (parts.length === 0) return undefined
  return `<configuration>\n${parts.join('\n')}\n</configuration>`
}

function readNodes(stepElements: HTMLCollectionOf<Element>, kind: 'step' | 'entry'): RawNode[] {
  const nodes: RawNode[] = []
  for (let i = 0; i < stepElements.length; i += 1) {
    const el = stepElements[i]
    const name = textOf(el, 'name') ?? ''
    const type = textOf(el, 'type') ?? ''
    const gui = child(el, 'GUI')
    nodes.push({
      name,
      type,
      kind,
      configXml: serializeNodeConfig(el),
      x: parseNumber(textOf(gui, 'xloc')),
      y: parseNumber(textOf(gui, 'yloc')),
      draw: textOf(gui, 'draw') === undefined ? undefined : parseBool(textOf(gui, 'draw')),
    })
  }
  return nodes
}

function textOfAny(el: Element | null, tags: string[]): string | undefined {
  if (!el) return undefined
  const targetTags = tags.map((t) => t.toLowerCase())
  for (let i = 0; i < el.children.length; i += 1) {
    const child = el.children[i]
    const local = (child.localName ?? child.nodeName).toLowerCase()
    if (targetTags.includes(local)) {
      const value = child.textContent?.trim()
      if (value) return value
    }
  }
  return undefined
}

function booleanFromErrorHandling(el: Element | null): boolean | undefined {
  if (!el) return undefined
  const enabled = textOfAny(el, ['enabled', 'active', 'use', 'is_enabled'])
  if (enabled !== undefined) return parseBool(enabled)
  const enabledAttr = el.getAttribute('enabled') ?? el.getAttribute('active') ?? el.getAttribute('use')
  if (enabledAttr === null || enabledAttr === '') return undefined
  return parseBool(enabledAttr)
}

function parseStepErrorHandlingFromName(el: Element): { source?: string; target?: string } {
  const source =
    textOfAny(el, ['from_step', 'from', 'source_step', 'source', 'source_step_name', 'step_from'])
    ?? el.getAttribute('from')
    ?? el.getAttribute('source')
    ?? el.getAttribute('source_step')

  const target =
    textOfAny(el, ['to_step', 'to', 'target_step', 'target', 'target_step_name', 'step_to'])
    ?? el.getAttribute('to')
    ?? el.getAttribute('target')
    ?? el.getAttribute('target_step')

  return { source, target }
}

type ErrorHandlerReference = {
  source: string
  target: string
  sourceIndex?: number
  targetIndex?: number
}

function parseErrorHopReferences(root: Element): ErrorHandlerReference[] {
  const rawErrorHops = root.getElementsByTagName('step_error_handling')
  const refs: ErrorHandlerReference[] = []
  for (let i = 0; i < rawErrorHops.length; i += 1) {
    const el = rawErrorHops[i]
    const errorEntries = Array.from(el.getElementsByTagName('error'))
    const effectiveEntries = errorEntries.length > 0 ? errorEntries : [el]

    for (const errorEntry of effectiveEntries) {
      const { source, target } = parseStepErrorHandlingFromName(errorEntry)
      if (!source || !target) continue

      const enabled = booleanFromErrorHandling(errorEntry)
      if (enabled === false) continue

      const sourceIndex = parseNumber(
        textOfAny(errorEntry, ['from_idx', 'source_idx', 'source_index', 'from_index', 'from_nr']),
      )
      const targetIndex = parseNumber(
        textOfAny(errorEntry, ['to_idx', 'target_idx', 'target_index', 'to_index', 'to_nr']),
      )

      refs.push({
        source,
        target,
        sourceIndex,
        targetIndex,
      })
    }
  }

  return refs
}

function addIndexVariants(values: Set<number>, index: number): void {
  values.add(index)
  values.add(index - 1)
}

function buildErrorHandlerRefSet(
  refs: ErrorHandlerReference[],
): {
  pairs: Set<string>
  pairsWithExactIndexes: Set<string>
  byPairWithSourceIndex: Map<string, Set<number>>
  byPairWithTargetIndex: Map<string, Set<number>>
  byPairWithBothIndexes: Set<string>
} {
  const pairs = new Set<string>()
  const pairsWithExactIndexes = new Set<string>()
  const byPairWithSourceIndex = new Map<string, Set<number>>()
  const byPairWithTargetIndex = new Map<string, Set<number>>()
  const byPairWithBothIndexes = new Set<string>()

  for (const ref of refs) {
    const pair = `${ref.source}\u0000${ref.target}`
    pairs.add(pair)

    if (ref.sourceIndex !== undefined) {
      const values = byPairWithSourceIndex.get(pair) ?? new Set<number>()
      addIndexVariants(values, ref.sourceIndex)
      byPairWithSourceIndex.set(pair, values)
    }

    if (ref.targetIndex !== undefined) {
      const values = byPairWithTargetIndex.get(pair) ?? new Set<number>()
      addIndexVariants(values, ref.targetIndex)
      byPairWithTargetIndex.set(pair, values)
    }

    if (ref.sourceIndex !== undefined && ref.targetIndex !== undefined) {
      const exactPair = `${pair}\u0000${ref.sourceIndex}\u0000${ref.targetIndex}`
      const exactPairAlternative = `${pair}\u0000${ref.sourceIndex - 1}\u0000${ref.targetIndex - 1}`
      const exactPairSource = `${pair}\u0000${ref.sourceIndex}\u0000${ref.targetIndex - 1}`
      const exactPairTarget = `${pair}\u0000${ref.sourceIndex - 1}\u0000${ref.targetIndex}`

      byPairWithBothIndexes.add(exactPair)
      byPairWithBothIndexes.add(exactPairAlternative)
      byPairWithBothIndexes.add(exactPairSource)
      byPairWithBothIndexes.add(exactPairTarget)
      pairsWithExactIndexes.add(pair)
    }
  }

  return {
    pairs,
    pairsWithExactIndexes,
    byPairWithSourceIndex,
    byPairWithTargetIndex,
    byPairWithBothIndexes,
  }
}

function disambiguate(raw: RawNode[]): KettleNode[] {
  const seen = new Map<string, number>()
  return raw.map((n, index) => {
    const count = seen.get(n.name) ?? 0
    seen.set(n.name, count + 1)
    const id = count === 0 ? n.name : `${n.name} (${count + 1})`
    return {
      uid: `n-${String(index + 1).padStart(4, '0')}`,
      id,
      name: n.name,
      type: n.type,
      kind: n.kind,
      configXml: n.configXml,
      x: n.x,
      y: n.y,
      draw: n.draw,
    }
  })
}

export function parseKettleFile(xml: string, fileName?: string): KettleGraph {
  const doc = parseXml(xml)
  const root = doc.documentElement
  const kind = detectKindFromRoot(root, fileName)

  const rawNodes = readNodes(root.getElementsByTagName(kind === 'transformation' ? 'step' : 'entry'), kind === 'transformation' ? 'step' : 'entry')
  const nodes = disambiguate(rawNodes)

  const idsByName = new Map<string, string[]>()
  for (const n of nodes) {
    const list = idsByName.get(n.name) ?? []
    list.push(n.id)
    idsByName.set(n.name, list)
  }

  const edges: KettleEdge[] = []
  const errorReferences = buildErrorHandlerRefSet(parseErrorHopReferences(root))
  const hops = root.getElementsByTagName('hop')
  const fromIdx = new Map<string, number>()
  const toIdx = new Map<string, number>()
  for (let i = 0; i < hops.length; i += 1) {
    const hop = hops[i]
    const from = textOf(hop, 'from') ?? ''
    const to = textOf(hop, 'to') ?? ''
    const enabled = parseBool(textOf(hop, 'enabled'))

    const fromList = idsByName.get(from) ?? []
    const toList = idsByName.get(to) ?? []
    if (fromList.length === 0 || toList.length === 0) {
      throw new KettleParseError(`Hop references a missing ${fromList.length === 0 ? 'source' : 'target'} step "${fromList.length === 0 ? from : to}".`)
    }
    const fromIndex = fromIdx.get(from) ?? 0
    const toIndex = toIdx.get(to) ?? 0
    fromIdx.set(from, fromIndex + 1)
    toIdx.set(to, toIndex + 1)

    const fromId = fromList[Math.min(fromIndex, fromList.length - 1)]
    const toId = toList[Math.min(toIndex, toList.length - 1)]
    const pair = `${from}\u0000${to}`
    const hopError = parseXmlBool(hop, 'error') === true
    const exactErrorMatch = `${pair}\u0000${fromIndex}\u0000${toIndex}`
    const bothIndexMatch = errorReferences.byPairWithBothIndexes.has(exactErrorMatch)
    const sourceIndexes = errorReferences.byPairWithSourceIndex.get(pair)
    const targetIndexes = errorReferences.byPairWithTargetIndex.get(pair)
    const constrainedBySourceOrTargetIndexes = sourceIndexes !== undefined || targetIndexes !== undefined
    const exactConstraint = errorReferences.pairsWithExactIndexes.has(pair)
    const isInStepErrorHandling = hopError || (() => {
      if (!errorReferences.pairs.has(pair)) return false
      if (exactConstraint) return bothIndexMatch
      if (!constrainedBySourceOrTargetIndexes) return true
      return (sourceIndexes ? sourceIndexes.has(fromIndex) : true) && (targetIndexes ? targetIndexes.has(toIndex) : true)
    })()

    edges.push({
      id: `e${i}`,
      from: fromId,
      to: toId,
      enabled,
      evaluation: parseXmlBool(hop, 'evaluation'),
      unconditional: parseXmlBool(hop, 'unconditional'),
      errorHandler: isInStepErrorHandling,
    })
  }

  const name = kind === 'transformation'
    ? textOf(child(root, 'info'), 'name')
    : textOf(root, 'name')

  return {
    kind,
    name: name ?? fileName?.split('/').pop()?.replace(/\.[^.]+$/, '') ?? 'Untitled',
    nodes,
    edges,
  }
}
