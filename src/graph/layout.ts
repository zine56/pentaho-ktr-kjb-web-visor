import * as dagre from '@dagrejs/dagre'
import type { KettleGraph, KettleNode } from '../model/graph'

export type Point = { x: number; y: number }

const NODE_WIDTH = 176
const NODE_HEIGHT = 48

export function hasAllPositions(nodes: KettleNode[]): boolean {
  return nodes.length > 0 && nodes.every((n) => typeof n.x === 'number' && typeof n.y === 'number')
}

function fromStoredPositions(nodes: KettleNode[]): Record<string, Point> {
  const out: Record<string, Point> = {}
  for (const n of nodes) {
    out[n.id] = { x: n.x as number, y: n.y as number }
  }
  return out
}

function dagreLayout(graph: KettleGraph): Record<string, Point> {
  const g = new dagre.graphlib.Graph()
  g.setGraph({ rankdir: 'LR', nodesep: 40, ranksep: 90 })
  g.setDefaultEdgeLabel(() => ({}))

  for (const n of graph.nodes) {
    g.setNode(n.id, { width: NODE_WIDTH, height: NODE_HEIGHT })
  }
  for (const e of graph.edges) {
    g.setEdge(e.from, e.to)
  }
  dagre.layout(g)

  const out: Record<string, Point> = {}
  for (const n of graph.nodes) {
    const pos = g.node(n.id)
    out[n.id] = { x: pos.x - NODE_WIDTH / 2, y: pos.y - NODE_HEIGHT / 2 }
  }
  return out
}

/**
 * Compute a position for every node. When Spoon layout coordinates are present
 * for all nodes they are preserved verbatim; otherwise the graph is laid out
 * with a Dagre left-to-right auto layout.
 */
export function computePositions(graph: KettleGraph): Record<string, Point> {
  if (hasAllPositions(graph.nodes)) {
    return fromStoredPositions(graph.nodes)
  }
  return dagreLayout(graph)
}
