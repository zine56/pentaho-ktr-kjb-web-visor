import { describe, expect, it } from 'vitest'
import type { KettleGraph } from '../model/graph'
import { renderHeadlessDiagram } from './headlessDiagram'

function graph(overrides: Partial<KettleGraph> = {}): KettleGraph {
  return {
    kind: 'transformation',
    name: 'Flujo <diagnóstico>',
    nodes: [
      {
        id: 'source',
        uid: 'n-0001',
        name: 'Entrada <A>',
        type: 'TableInput',
        kind: 'step',
        x: -40,
        y: 20,
        configXml: '<password>NO_DEBE_APARECER</password>',
      },
      {
        id: 'target',
        uid: 'n-0002',
        name: 'Salida & B',
        type: 'Dummy',
        kind: 'step',
        x: 400,
        y: 20,
      },
    ],
    edges: [
      {
        id: 'e0',
        from: 'source',
        to: 'target',
        enabled: true,
        filterResult: 'true',
      },
    ],
    notes: [
      {
        id: 'note-1',
        text: 'Nota & control',
        x: -80,
        y: 180,
        width: 180,
        height: 70,
      },
    ],
    ...overrides,
  }
}

describe('renderHeadlessDiagram', () => {
  it('is deterministic, valid XML and escapes visible text', () => {
    const options = {
      sourceBasename: 'flujo.ktr',
      sourceSha256: 'a'.repeat(64),
    }
    const first = renderHeadlessDiagram(graph(), options)
    const second = renderHeadlessDiagram(graph(), options)

    expect(first.svg).toBe(second.svg)
    expect(first.report).toEqual(second.report)
    expect(first.svg).toContain('Flujo &lt;diagnóstico&gt;')
    expect(first.svg).toContain('Entrada &lt;A&gt;')
    expect(first.svg).toContain('Salida &amp; B')
    expect(first.svg).toContain('Nota &amp; control')
    expect(first.svg).not.toContain('NO_DEBE_APARECER')
    expect(first.svg).not.toContain('<configuration>')
    expect(first.svg).not.toMatch(/file:\/\//i)
    expect(first.svg).not.toMatch(/(?:href|src)=["']https?:\/\//i)

    const parsed = new DOMParser().parseFromString(first.svg, 'application/xml')
    expect(parsed.getElementsByTagName('parsererror')).toHaveLength(0)
    expect(parsed.documentElement.localName).toBe('svg')
    expect(first.width).toBeGreaterThan(0)
    expect(first.height).toBeGreaterThan(0)
  })

  it('detects node footprints that overlap or lack visual padding', () => {
    const source = graph()
    source.nodes[1] = { ...source.nodes[1], x: 100 }
    source.edges = []
    source.notes = []

    const result = renderHeadlessDiagram(source)

    expect(result.report.status).toBe('FAIL')
    expect(result.report.collisionCounts['node-node']).toBe(1)
    expect(result.report.blockingCollisionCount).toBe(1)
  })

  it('detects a hop crossing a third node label footprint', () => {
    const source = graph({
      nodes: [
        { id: 'a', uid: 'n-0001', name: 'A', type: 'Dummy', kind: 'step', x: 0, y: 0 },
        { id: 'middle', uid: 'n-0002', name: 'Nodo intermedio', type: 'Dummy', kind: 'step', x: 300, y: 0 },
        { id: 'b', uid: 'n-0003', name: 'B', type: 'Dummy', kind: 'step', x: 600, y: 0 },
      ],
      edges: [{ id: 'e0', from: 'a', to: 'b', enabled: true }],
      notes: [],
    })

    const result = renderHeadlessDiagram(source)

    expect(result.report.status).toBe('FAIL')
    expect(result.report.collisionCounts['edge-node']).toBe(1)
    expect(result.report.collisions).toContainEqual(expect.objectContaining({
      kind: 'edge-node',
      second: 'Nodo intermedio',
    }))
  })

  it('keeps source metadata redacted and records missing Spoon coordinates', () => {
    const source = graph()
    source.nodes[0] = { ...source.nodes[0], x: undefined }

    const result = renderHeadlessDiagram(source, {
      sourceBasename: 'solo-nombre.ktr',
      sourceSha256: 'b'.repeat(64),
    })

    expect(result.report.source).toEqual({
      basename: 'solo-nombre.ktr',
      sha256: 'b'.repeat(64),
    })
    expect(result.report.renderer.spoonCoordinatesPreserved).toBe(false)
    expect(JSON.stringify(result.report)).not.toContain('C:\\')
  })
})
