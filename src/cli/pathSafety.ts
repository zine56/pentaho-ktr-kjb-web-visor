import { existsSync, realpathSync, statSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'

interface NamedPath {
  label: string
  path: string
}

function foldCase(path: string, platform: NodeJS.Platform): string {
  return platform === 'win32' ? path.toLocaleLowerCase('en-US') : path
}

function canonicalPath(path: string): string {
  const absolute = resolve(path)
  if (existsSync(absolute)) return realpathSync.native(absolute)

  const parent = dirname(absolute)
  if (existsSync(parent)) return join(realpathSync.native(parent), basename(absolute))
  return absolute
}

function identities(path: string, platform: NodeJS.Platform): string[] {
  const canonical = canonicalPath(path)
  const keys = [`path:${foldCase(canonical, platform)}`]
  if (existsSync(canonical)) {
    const metadata = statSync(canonical)
    keys.push(`inode:${metadata.dev}:${metadata.ino}`)
  }
  return keys
}

export function assertDistinctPaths(
  paths: NamedPath[],
  platform: NodeJS.Platform = process.platform,
): void {
  const owners = new Map<string, string>()
  for (const entry of paths) {
    for (const identity of identities(entry.path, platform)) {
      const owner = owners.get(identity)
      if (owner) {
        throw new Error(`${entry.label} y ${owner} no pueden apuntar al mismo archivo.`)
      }
      owners.set(identity, entry.label)
    }
  }
}
