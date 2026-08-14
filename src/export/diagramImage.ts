import { getRectOfNodes, type GraphNode } from '@vue-flow/core'

export type DiagramImageFormat = 'png' | 'svg'

const EXPORT_PADDING = 64

export function sanitizeExportFilename(value: string): string {
  const sanitized = value
    .trim()
    .replace(/\.(ktr|kjb)$/i, '')
    .replace(/[<>:"/\\|?*\x00-\x1f]+/g, '-')
    .replace(/\s+/g, '_')
    .replace(/^[._-]+|[._-]+$/g, '')

  return sanitized || 'diagrama-pentaho'
}

function waitForImage(image: HTMLImageElement): Promise<void> {
  if (image.complete) return Promise.resolve()

  return new Promise((resolve) => {
    let timeoutId = 0
    const settle = () => {
      image.removeEventListener('load', settle)
      image.removeEventListener('error', settle)
      window.clearTimeout(timeoutId)
      resolve()
    }

    image.addEventListener('load', settle, { once: true })
    image.addEventListener('error', settle, { once: true })
    timeoutId = window.setTimeout(settle, 3000)
  })
}

function downloadDataUrl(dataUrl: string, filename: string) {
  const link = document.createElement('a')
  link.download = filename
  link.href = dataUrl
  link.style.display = 'none'
  document.body.appendChild(link)
  link.click()
  link.remove()
}

export async function exportDiagramImage(options: {
  pane: HTMLElement
  nodes: GraphNode[]
  name: string
  format: DiagramImageFormat
}): Promise<string> {
  const visibleNodes = options.nodes.filter((node) => !node.hidden)
  if (visibleNodes.length === 0) {
    throw new Error('No hay elementos visibles para exportar.')
  }

  await document.fonts?.ready
  await Promise.all(Array.from(options.pane.querySelectorAll('img')).map(waitForImage))

  const bounds = getRectOfNodes(visibleNodes)
  const width = Math.max(1, Math.ceil(bounds.width + EXPORT_PADDING * 2))
  const height = Math.max(1, Math.ceil(bounds.height + EXPORT_PADDING * 2))
  const filename = `${sanitizeExportFilename(options.name)}.${options.format}`
  const { toPng, toSvg } = await import('html-to-image')
  const renderOptions = {
    backgroundColor: '#ffffff',
    cacheBust: true,
    width,
    height,
    style: {
      width: `${width}px`,
      height: `${height}px`,
      left: '0',
      top: '0',
      transform: `translate(${EXPORT_PADDING - bounds.x}px, ${EXPORT_PADDING - bounds.y}px) scale(1)`,
      transformOrigin: 'top left',
    },
  }

  const dataUrl = options.format === 'png'
    ? await toPng(options.pane, { ...renderOptions, pixelRatio: 2 })
    : await toSvg(options.pane, renderOptions)

  downloadDataUrl(dataUrl, filename)
  return filename
}
