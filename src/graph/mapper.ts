import type { Edge, Node } from '@vue-flow/core'
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
  strokeWidth: 2.4,
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

    return {
      id: e.id,
      source: e.from,
      target: e.to,
      class: Array.from(edgeClass),
      ...(Object.keys(style).length === 0 ? {} : { style }),
    }
  })

  return { nodes, edges }
}
