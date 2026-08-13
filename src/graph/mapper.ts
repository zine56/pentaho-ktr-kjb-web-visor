import type { Edge, Node } from '@vue-flow/core'
import type { KettleGraph, KettleNode } from '../model/graph'
import { computePositions } from './layout'

export interface StepNodeData extends Record<string, unknown> {
  name: string
  type: string
  kind: KettleNode['kind']
}

const DISABLED_EDGE_STYLE = {
  stroke: '#b91c1c',
  strokeDasharray: '6 4',
}

export function toVueFlow(graph: KettleGraph): { nodes: Node[]; edges: Edge[] } {
  const positions = computePositions(graph)

  const nodes: Node[] = graph.nodes.map((n) => ({
    id: n.id,
    type: 'step',
    position: positions[n.id] ?? { x: 0, y: 0 },
    data: { name: n.name, type: n.type, kind: n.kind } satisfies StepNodeData,
  }))

  const edges: Edge[] = graph.edges.map((e) => ({
    id: e.id,
    source: e.from,
    target: e.to,
    ...(e.enabled ? {} : { style: DISABLED_EDGE_STYLE }),
  }))

  return { nodes, edges }
}
