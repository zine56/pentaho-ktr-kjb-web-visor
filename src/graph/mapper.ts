import { MarkerType, type Edge, type Node } from '@vue-flow/core'
import type { KettleGraph, KettleNode, KettleNote } from '../model/graph'
import { computePositions } from './layout'

export interface StepNodeData extends Record<string, unknown> {
  uid: string
  name: string
  type: string
  kind: KettleNode['kind']
  configXml?: string
  highlighted?: boolean
}

export interface NoteNodeData extends Record<string, unknown> {
  kind: 'note'
  text: string
  width: number
  height: number
  fontName?: string
  fontSize?: number
  fontBold?: boolean
  fontItalic?: boolean
  fontColor?: string
  backgroundColor?: string
  borderColor?: string
  drawShadow?: boolean
}

export type FlowNodeData = StepNodeData | NoteNodeData

const DISABLED_EDGE_STYLE = {
  stroke: '#b91c1c',
  strokeDasharray: '6 4',
}

const ERROR_HANDLER_EDGE_STYLE = {
  stroke: '#b91c1c',
  strokeWidth: 2,
}

const FILTER_RESULT_LABEL_STYLE = {
  true: {
    text: '#166534',
    background: '#f0fdf4',
    border: '#86efac',
  },
  false: {
    text: '#991b1b',
    background: '#fef2f2',
    border: '#fca5a5',
  },
} as const

function resolveEdgeHandles(
  source: { x: number; y: number },
  target: { x: number; y: number },
): { sourceHandle: string; targetHandle: string } {
  const dx = target.x - source.x
  const dy = target.y - source.y

  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx >= 0
      ? { sourceHandle: 'source-right', targetHandle: 'target-left' }
      : { sourceHandle: 'source-left', targetHandle: 'target-right' }
  }

  return dy >= 0
    ? { sourceHandle: 'source-bottom', targetHandle: 'target-top' }
    : { sourceHandle: 'source-top', targetHandle: 'target-bottom' }
}

function toNoteNode(note: KettleNote): Node<NoteNodeData> {
  return {
    id: note.id,
    type: 'note',
    position: { x: note.x, y: note.y },
    data: {
      kind: 'note',
      text: note.text,
      width: note.width,
      height: note.height,
      fontName: note.fontName,
      fontSize: note.fontSize,
      fontBold: note.fontBold,
      fontItalic: note.fontItalic,
      fontColor: note.fontColor,
      backgroundColor: note.backgroundColor,
      borderColor: note.borderColor,
      drawShadow: note.drawShadow,
    },
    style: {
      width: `${note.width}px`,
      height: `${note.height}px`,
    },
    class: 'kettle-note-node',
    draggable: false,
    selectable: false,
    connectable: false,
    zIndex: -1,
  }
}

export function toVueFlow(graph: KettleGraph): { nodes: Node<FlowNodeData>[]; edges: Edge[] } {
  const positions = computePositions(graph)

  const stepNodes: Node<StepNodeData>[] = graph.nodes.map((n) => ({
    id: n.id,
    type: 'step',
    position: positions[n.id] ?? { x: 0, y: 0 },
    data: {
      uid: n.uid,
      name: n.name,
      type: n.type,
      kind: n.kind,
      configXml: n.configXml,
    } satisfies StepNodeData,
  }))

  const nodes: Node<FlowNodeData>[] = [
    ...graph.notes.map(toNoteNode),
    ...stepNodes,
  ]

  const edges: Edge[] = graph.edges.map((e) => {
    const style: Record<string, string | number> = {}
    const edgeClass = new Set<string>()
    if (!e.enabled) {
      Object.assign(style, DISABLED_EDGE_STYLE)
    }
    if (e.errorHandler) {
      Object.assign(style, ERROR_HANDLER_EDGE_STYLE)
      edgeClass.add('error-handler-edge')
    }

    const filterLabelStyle = e.filterResult
      ? FILTER_RESULT_LABEL_STYLE[e.filterResult]
      : undefined
    const markerColor = typeof style.stroke === 'string' ? style.stroke : '#b1b1b7'
    const handles = resolveEdgeHandles(
      positions[e.from] ?? { x: 0, y: 0 },
      positions[e.to] ?? { x: 0, y: 0 },
    )

    return {
      id: e.id,
      source: e.from,
      target: e.to,
      sourceHandle: handles.sourceHandle,
      targetHandle: handles.targetHandle,
      class: Array.from(edgeClass),
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: markerColor,
        width: e.errorHandler ? 14 : 18,
        height: e.errorHandler ? 14 : 18,
      },
      ...(Object.keys(style).length === 0 ? {} : { style }),
      ...(e.filterResult && filterLabelStyle
        ? {
            label: e.filterResult,
            labelStyle: {
              fill: filterLabelStyle.text,
              fontSize: 12,
              fontWeight: 700,
            },
            labelBgStyle: {
              fill: filterLabelStyle.background,
              stroke: filterLabelStyle.border,
              strokeWidth: 1,
            },
            labelBgPadding: [5, 3] as [number, number],
            labelBgBorderRadius: 4,
          }
        : {}),
    }
  })

  return { nodes, edges }
}
