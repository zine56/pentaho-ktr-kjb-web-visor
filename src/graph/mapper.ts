import type { Edge, Node } from '@vue-flow/core'
import type { KettleGraph, KettleNode } from '../model/graph'
import { computePositions } from './layout'

export interface StepNodeData extends Record<string, unknown> {
  uid: string
  name: string
  type: string
  kind: KettleNode['kind']
  configXml?: string
  highlighted?: boolean
}

const DISABLED_EDGE_STYLE = {
  stroke: '#b91c1c',
  strokeDasharray: '6 4',
}

const ERROR_HANDLER_EDGE_STYLE = {
  stroke: '#b91c1c',
  strokeWidth: 2.4,
}

export function toVueFlow(graph: KettleGraph): { nodes: Node<StepNodeData>[]; edges: Edge[] } {
  const positions = computePositions(graph)

  const nodes: Node<StepNodeData>[] = graph.nodes.map((n) => ({
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

  const edges: Edge[] = graph.edges.map((e) => {
    const style: Record<string, string | number> = {}
    if (!e.enabled) {
      Object.assign(style, DISABLED_EDGE_STYLE)
    }
    if (e.errorHandler) {
      Object.assign(style, ERROR_HANDLER_EDGE_STYLE)
    }

    return {
      id: e.id,
      source: e.from,
      target: e.to,
      ...(Object.keys(style).length === 0 ? {} : { style }),
    }
  })

  return { nodes, edges }
}
