import { linkSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { describe, expect, it } from 'vitest'
import { assertDistinctPaths } from './pathSafety'

describe('assertDistinctPaths', () => {
  it('rejects the same Windows path with different casing', () => {
    expect(() => assertDistinctPaths([
      { label: '--input', path: 'C:\\Temporal\\Flujo.ktr' },
      { label: '--svg', path: 'c:\\temporal\\FLUJO.KTR' },
    ], 'win32')).toThrow(/mismo archivo/)
  })

  it('rejects two outputs with the same resolved path', () => {
    expect(() => assertDistinctPaths([
      { label: '--svg', path: './salida/../layout.svg' },
      { label: '--report', path: './layout.svg' },
    ])).toThrow(/mismo archivo/)
  })

  it('rejects existing hard links to the same file', () => {
    const root = mkdtempSync(join(tmpdir(), 'pentaho-path-safety-'))
    const path = join(root, 'flow.ktr')
    const alias = join(root, 'flow-alias.ktr')
    try {
      writeFileSync(path, '<transformation/>')
      linkSync(path, alias)
      expect(() => assertDistinctPaths([
        { label: '--input', path },
        { label: '--svg', path: alias },
      ])).toThrow(/mismo archivo/)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('accepts distinct local paths', () => {
    expect(() => assertDistinctPaths([
      { label: '--input', path: './flow.ktr' },
      { label: '--svg', path: './flow.svg' },
      { label: '--report', path: './flow.json' },
    ])).not.toThrow()
  })

  it('resolves a junction or symlink before nonexistent child directories', () => {
    const root = mkdtempSync(join(tmpdir(), 'pentaho-junction-safety-'))
    const target = join(root, 'target')
    const alias = join(root, 'alias')
    try {
      mkdirSync(target)
      symlinkSync(target, alias, process.platform === 'win32' ? 'junction' : 'dir')

      expect(() => assertDistinctPaths([
        { label: '--svg', path: join(target, 'nested', 'same.out') },
        { label: '--report', path: join(alias, 'nested', 'same.out') },
      ])).toThrow(/mismo archivo/)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
})
