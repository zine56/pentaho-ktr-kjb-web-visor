import { describe, expect, it } from 'vitest'
import { sanitizeExportFilename } from './diagramImage'

describe('sanitizeExportFilename', () => {
  it('creates a portable filename from a Kettle graph name', () => {
    expect(sanitizeExportFilename('Mi transformacion.ktr')).toBe('Mi_transformacion')
    expect(sanitizeExportFilename('  Job: carga / diaria.kjb  ')).toBe('Job-_carga_-_diaria')
  })

  it('uses a fallback when the name has no portable characters', () => {
    expect(sanitizeExportFilename('***')).toBe('diagrama-pentaho')
  })
})
