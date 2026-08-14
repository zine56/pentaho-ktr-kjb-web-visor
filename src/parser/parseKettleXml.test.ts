import { describe, it, expect } from 'vitest'
import { parseKettleFile, detectKind, KettleParseError } from './parseKettleXml'
import ktrFixture from './samples/table-input.ktr?raw'
import kjbFixture from './samples/basic-job.kjb?raw'

describe('parseKettleXml', () => {
  it('parses a transformation into nodes, positions and hops', () => {
    const g = parseKettleFile(ktrFixture, 'table-input.ktr')

    expect(g.kind).toBe('transformation')
    expect(g.name).toBe('Sample table input')
    expect(g.nodes).toHaveLength(3)
    expect(g.nodes.map((n) => n.type)).toEqual(['TableInput', 'SelectValues', 'Dummy'])
    expect(g.nodes[0].x).toBe(160)
    expect(g.nodes[0].y).toBe(80)
    expect(g.nodes[0].kind).toBe('step')

    expect(g.edges).toHaveLength(2)
    expect(g.edges[0]).toMatchObject({ from: 'Table input', to: 'Select values', enabled: true })
    expect(g.edges[1]).toMatchObject({ from: 'Select values', to: 'Dummy (do nothing)' })
  })

  it('parses a job into entries and hops with evaluation/unconditional flags', () => {
    const g = parseKettleFile(kjbFixture, 'basic-job.kjb')

    expect(g.kind).toBe('job')
    expect(g.name).toBe('Sample basic job')
    expect(g.nodes).toHaveLength(2)
    expect(g.nodes[0]).toMatchObject({ name: 'START', type: 'SPECIAL', kind: 'entry' })
    expect(g.nodes[1].type).toBe('TRANS')

    expect(g.edges).toHaveLength(1)
    expect(g.edges[0]).toMatchObject({
      from: 'START',
      to: 'Run transform',
      enabled: true,
      evaluation: true,
      unconditional: true,
    })
  })

  it('leaves x/y undefined when <GUI> is absent', () => {
    const xml = `<transformation><info><name>t</name></info>
      <step><name>A</name><type>Dummy</type></step></transformation>`
    const g = parseKettleFile(xml, 't.ktr')
    expect(g.nodes[0].x).toBeUndefined()
    expect(g.nodes[0].y).toBeUndefined()
  })

  it('disambiguates duplicate step names and resolves hops by occurrence order', () => {
    const xml = `<transformation>
      <step><name>Calc</name><type>Calculator</type></step>
      <step><name>Calc</name><type>Calculator</type></step>
      <step><name>Out</name><type>Dummy</type></step>
      <hop><from>Calc</from><to>Out</to><enabled>Y</enabled></hop>
      <hop><from>Calc</from><to>Out</to><enabled>Y</enabled></hop>
    </transformation>`
    const g = parseKettleFile(xml, 'dup.ktr')
    expect(g.nodes.map((n) => n.id)).toEqual(['Calc', 'Calc (2)', 'Out'])
    expect(g.edges[0]).toMatchObject({ from: 'Calc', to: 'Out' })
    expect(g.edges[1]).toMatchObject({ from: 'Calc (2)', to: 'Out' })
  })

  it('parses a disabled hop as enabled=false', () => {
    const xml = `<transformation>
      <step><name>A</name><type>Dummy</type></step>
      <step><name>B</name><type>Dummy</type></step>
      <hop><from>A</from><to>B</to><enabled>N</enabled></hop>
    </transformation>`
    const g = parseKettleFile(xml, 't.ktr')
    expect(g.edges[0].enabled).toBe(false)
  })

  it('reads an error-handler hop from XML', () => {
    const xml = `<job>
      <name>err</name>
      <entries>
        <entry><name>START</name><type>SPECIAL</type></entry>
        <entry><name>Fail</name><type>TRANS</type></entry>
      </entries>
      <hops>
        <hop><from>START</from><to>Fail</to><enabled>Y</enabled><error>Y</error></hop>
      </hops>
    </job>`

    const g = parseKettleFile(xml, 'err.kjb')
    expect(g.edges[0].errorHandler).toBe(true)
  })

  it('throws KettleParseError on malformed XML', () => {
    expect(() => parseKettleFile('<transformation><step>', 't.ktr')).toThrow(KettleParseError)
  })

  it('throws KettleParseError on an unknown root element', () => {
    expect(() => parseKettleFile('<foo><bar/></foo>', 't.xml')).toThrow(KettleParseError)
  })

  it('throws KettleParseError when a hop references a missing node', () => {
    const xml = `<transformation>
      <step><name>A</name><type>Dummy</type></step>
      <hop><from>A</from><to>Missing</to><enabled>Y</enabled></hop>
    </transformation>`
    expect(() => parseKettleFile(xml, 't.ktr')).toThrow(/missing target/i)
  })
})

describe('detectKind', () => {
  it('detects by root element', () => {
    expect(detectKind('<transformation/>', 'x.ktr')).toBe('transformation')
    expect(detectKind('<job/>', 'x.kjb')).toBe('job')
  })

  it('falls back to the filename extension', () => {
    expect(detectKind('<foo/>', 'x.ktr')).toBe('transformation')
    expect(detectKind('<foo/>', 'x.kjb')).toBe('job')
  })
})
