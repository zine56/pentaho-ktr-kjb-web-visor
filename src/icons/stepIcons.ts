import { resolveIconFile } from './iconManifest'
import type { KettleNode } from '../model/graph'

const iconModules = import.meta.glob('../assets/pentaho-icons/*', {
  eager: true,
  import: 'default',
}) as Record<string, string>

const iconByFile: Record<string, string> = {}
for (const [path, url] of Object.entries(iconModules)) {
  iconByFile[path.split('/').pop() as string] = url
}

/**
 * Resolve a Kettle node to a bundled icon URL, falling back to a generic icon
 * so a node is never rendered without an image.
 */
export function resolveStepIcon(node: Pick<KettleNode, 'type' | 'kind'>): string {
  const file = resolveIconFile(node.type, node.kind)
  return iconByFile[file] ?? iconByFile['generic-step.svg'] ?? ''
}
