import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { describe, expect, it } from 'vitest'


describe('exportKettle CLI', () => {
  it('reports FAIL and exits 2 when the collision gate rejects the layout', () => {
    const root = mkdtempSync(join(tmpdir(), 'pentaho-cli-collision-'))
    try {
      const source = readFileSync(
        resolve('src/parser/samples/table-input.ktr'),
        'utf8',
      ).replace('<xloc>400</xloc>', '<xloc>160</xloc>')
      const input = join(root, 'collision.ktr')
      writeFileSync(input, source)

      const result = spawnSync(process.execPath, [
        resolve('node_modules/vite-node/vite-node.mjs'),
        resolve('src/cli/exportKettle.ts'),
        '--input', input,
        '--svg', join(root, 'collision.svg'),
        '--report', join(root, 'collision.json'),
        '--fail-on-collisions',
      ], {
        cwd: resolve('.'),
        encoding: 'utf8',
        shell: false,
        windowsHide: true,
        timeout: 30_000,
      })

      expect(result.status).toBe(2)
      expect(result.stdout).toContain('FAIL layout headless: collision.ktr')
      expect(result.stdout).not.toContain('PASS export headless')
      expect(result.stderr).toBe('')
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
})
