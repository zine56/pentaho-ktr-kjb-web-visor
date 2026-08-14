import { describe, it, expect } from 'vitest'
import { toVueFlow } from './mapper'
import type { KettleGraph } from '../model/graph'

function makeGraph(partial: Partial<KettleGraph>): KettleGraph {
  return {
    kind: 'transformation',
    name: 't',
    nodes: [],
    edges: [],
    ...partial,
  }
}

describe('toVueFlow', () => {
  it('preserves stored Spoon positions when every node has x/y', () => {
    const graph = makeGraph({
      nodes: [
        { uid: 'n-0001', id: 'a', name: 'A', type: 'Dummy', kind: 'step', x: 120, y: 90 },
        { uid: 'n-0002', id: 'b', name: 'B', type: 'Dummy', kind: 'step', x: 400, y: 90 },
      ],
      edges: [{ id: 'e0', from: 'a', to: 'b', enabled: true }],
    })

    const { nodes, edges } = toVueFlow(graph)
    expect(nodes[0].position).toEqual({ x: 120, y: 90 })
    expect(nodes[1].position).toEqual({ x: 400, y: 90 })
    expect(nodes[0].type).toBe('step')
    expect(nodes[0].data).toMatchObject({ name: 'A', type: 'Dummy', kind: 'step' })
    expect(edges[0]).toMatchObject({ source: 'a', target: 'b' })
  })

  it('auto-layouts with dagre when positions are missing', () => {
    const graph = makeGraph({
      nodes: [
        { uid: 'n-0001', id: 'a', name: 'A', type: 'Dummy', kind: 'step' },
        { uid: 'n-0002', id: 'b', name: 'B', type: 'Dummy', kind: 'step' },
      ],
      edges: [{ id: 'e0', from: 'a', to: 'b', enabled: true }],
    })

    const { nodes } = toVueFlow(graph)
    for (const n of nodes) {
      expect(typeof n.position.x).toBe('number')
      expect(typeof n.position.y).toBe('number')
    }
    // The two nodes should not be stacked at the identical position.
    expect(nodes[0].position).not.toEqual(nodes[1].position)
  })

  it('styles disabled hops distinctly', () => {
    const graph = makeGraph({
      nodes: [
        { uid: 'n-0001', id: 'a', name: 'A', type: 'Dummy', kind: 'step' },
        { uid: 'n-0002', id: 'b', name: 'B', type: 'Dummy', kind: 'step' },
      ],
      edges: [
        { id: 'on', from: 'a', to: 'b', enabled: true },
        { id: 'off', from: 'b', to: 'a', enabled: false },
      ],
    })

    const { edges } = toVueFlow(graph)
    expect(edges[0].style).toBeUndefined()
    expect(edges[1].style).toBeDefined()
  })
})
