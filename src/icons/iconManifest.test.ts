import { describe, it, expect } from 'vitest'
import { resolveIconFile, ICON_MAP } from './iconManifest'

describe('iconManifest', () => {
  it('maps known step types to Pentaho icons', () => {
    expect(resolveIconFile('TableInput', 'step')).toBe('TIP.png')
    expect(resolveIconFile('SelectValues', 'step')).toBe('SEL.svg')
    expect(resolveIconFile('FilterRows', 'step')).toBe('FLT.svg')
    expect(resolveIconFile('Dummy', 'step')).toBe('DUM.svg')
    expect(resolveIconFile('ScriptValueMod', 'step')).toBe('ModifiedJavaScriptValue.png')
    expect(resolveIconFile('ModifiedJavaScriptValue', 'step')).toBe('ModifiedJavaScriptValue.png')
    expect(resolveIconFile('Modified JavaScript Value', 'step')).toBe('ModifiedJavaScriptValue.png')
    expect(resolveIconFile('modified-javascript-value', 'step')).toBe('ModifiedJavaScriptValue.png')
  })

  it('maps known job entry types to Pentaho icons', () => {
    expect(resolveIconFile('TRANS', 'entry')).toBe('TRN.svg')
    expect(resolveIconFile('JOB', 'entry')).toBe('JOB.svg')
    expect(resolveIconFile('SQL', 'entry')).toBe('SQL.svg')
  })

  it('uses the special icon for START/DUMMY job entries', () => {
    expect(resolveIconFile('SPECIAL', 'entry')).toBe('special.svg')
  })

  it('falls back to a generic step icon for unknown step types', () => {
    expect(resolveIconFile('TotallyUnknownStep', 'step')).toBe('generic-step.svg')
  })

  it('falls back to a generic job icon for unknown job types', () => {
    expect(resolveIconFile('TotallyUnknownEntry', 'entry')).toBe('generic-job.svg')
  })

  it('every manifest value is a non-empty filename', () => {
    for (const [type, file] of Object.entries(ICON_MAP)) {
      expect(file, `icon for ${type}`).toBeTruthy()
    }
  })
})
