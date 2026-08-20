import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, dirname, extname, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { JSDOM } from 'jsdom'
import { renderHeadlessDiagram, type Rect } from '../export/headlessDiagram'
import { parseKettleFile } from '../parser/parseKettleXml'
import { assertDistinctPaths } from './pathSafety'

interface CliOptions {
  input: string
  svg: string
  report: string
  png?: string
  browser?: string
  viewport?: Rect
  positions?: string
  layout: 'spoon' | 'dagre'
  force: boolean
  failOnCollisions: boolean
}

function usage(): string {
  return [
    'Uso:',
    '  npm run export:headless -- --input flujo.ktr --svg flujo.svg --report layout.json',
    '    [--png flujo.png --browser chrome.exe] [--viewport x,y,width,height]',
    '    [--layout spoon|dagre] [--positions posiciones.json]',
    '    [--force] [--fail-on-collisions]',
  ].join('\n')
}

function readValue(argv: string[], index: number, flag: string): string {
  const value = argv[index + 1]
  if (!value || value.startsWith('--')) throw new Error(`Falta valor para ${flag}.`)
  return value
}

function parseViewport(value: string): Rect {
  const numbers = value.split(',').map((part) => Number(part.trim()))
  if (numbers.length !== 4 || numbers.some((number) => !Number.isFinite(number))) {
    throw new Error('--viewport debe usar x,y,width,height numéricos.')
  }
  const [x, y, width, height] = numbers
  if (width <= 0 || height <= 0) throw new Error('El viewport debe tener ancho y alto positivos.')
  return { x, y, width, height }
}

function parseArgs(argv: string[]): CliOptions {
  const values: Partial<CliOptions> = {
    force: false,
    failOnCollisions: false,
    layout: 'spoon',
  }

  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index]
    switch (flag) {
      case '--input':
        values.input = readValue(argv, index, flag)
        index += 1
        break
      case '--svg':
        values.svg = readValue(argv, index, flag)
        index += 1
        break
      case '--report':
        values.report = readValue(argv, index, flag)
        index += 1
        break
      case '--png':
        values.png = readValue(argv, index, flag)
        index += 1
        break
      case '--browser':
        values.browser = readValue(argv, index, flag)
        index += 1
        break
      case '--viewport':
        values.viewport = parseViewport(readValue(argv, index, flag))
        index += 1
        break
      case '--positions':
        values.positions = readValue(argv, index, flag)
        index += 1
        break
      case '--layout': {
        const layout = readValue(argv, index, flag)
        if (layout !== 'spoon' && layout !== 'dagre') {
          throw new Error('--layout debe ser spoon o dagre.')
        }
        values.layout = layout
        index += 1
        break
      }
      case '--force':
        values.force = true
        break
      case '--fail-on-collisions':
        values.failOnCollisions = true
        break
      case '--help':
      case '-h':
        process.stdout.write(`${usage()}\n`)
        process.exit(0)
        break
      default:
        throw new Error(`Argumento desconocido: ${flag}`)
    }
  }

  if (!values.input || !values.svg || !values.report) {
    throw new Error(`--input, --svg y --report son obligatorios.\n${usage()}`)
  }
  if ((values.png && !values.browser) || (values.browser && !values.png)) {
    throw new Error('--png y --browser deben indicarse juntos.')
  }

  return values as CliOptions
}

function ensureLocalFile(path: string, label: string): string {
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(path)) {
    throw new Error(`${label} debe ser una ruta local, no una URL.`)
  }
  return resolve(path)
}

function ensureWritable(path: string, force: boolean): void {
  if (existsSync(path) && !force) {
    throw new Error(`El destino ${basename(path)} ya existe; use --force para reemplazarlo.`)
  }
  mkdirSync(dirname(path), { recursive: true })
}

function atomicWrite(path: string, content: string | Buffer): void {
  const temporary = join(dirname(path), `.${basename(path)}.${process.pid}.tmp`)
  try {
    writeFileSync(temporary, content)
    renameSync(temporary, path)
  } finally {
    if (existsSync(temporary)) unlinkSync(temporary)
  }
}

function assertPng(path: string, expectedWidth: number, expectedHeight: number): void {
  const bytes = readFileSync(path)
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  if (bytes.length < 24 || !bytes.subarray(0, 8).equals(signature)) {
    throw new Error('El browser no produjo un PNG válido.')
  }
  const width = bytes.readUInt32BE(16)
  const height = bytes.readUInt32BE(20)
  if (width !== expectedWidth || height !== expectedHeight) {
    throw new Error(`PNG inesperado: ${width}x${height}; esperado ${expectedWidth}x${expectedHeight}.`)
  }
}

function renderPng(options: {
  browser: string
  svg: string
  png: string
  width: number
  height: number
}): void {
  if (!existsSync(options.browser)) throw new Error('No existe el browser local indicado.')
  const profile = mkdtempSync(join(tmpdir(), 'pentaho-headless-'))
  const temporaryPng = join(dirname(options.png), `.${basename(options.png)}.${process.pid}.tmp.png`)
  const argumentsList = [
    '--headless=new',
    '--disable-background-networking',
    '--disable-component-update',
    '--disable-default-apps',
    '--disable-extensions',
    '--disable-sync',
    '--hide-scrollbars',
    '--no-first-run',
    '--no-default-browser-check',
    '--force-device-scale-factor=1',
    '--host-resolver-rules=MAP * 0.0.0.0',
    `--user-data-dir=${profile}`,
    `--window-size=${options.width},${options.height}`,
    `--screenshot=${temporaryPng}`,
    pathToFileURL(options.svg).href,
  ]

  try {
    const result = spawnSync(options.browser, argumentsList, {
      encoding: 'utf8',
      shell: false,
      windowsHide: true,
      timeout: 60_000,
    })
    if (result.error || result.status !== 0) {
      throw new Error(`Chrome headless falló con estado ${result.status ?? 'desconocido'}.`)
    }
    assertPng(temporaryPng, options.width, options.height)
    renameSync(temporaryPng, options.png)
  } finally {
    if (existsSync(temporaryPng)) unlinkSync(temporaryPng)
    rmSync(profile, { recursive: true, force: true })
  }
}

function installDomGlobals(): void {
  const dom = new JSDOM('<!doctype html><html><body></body></html>')
  Object.assign(globalThis, {
    DOMParser: dom.window.DOMParser,
    XMLSerializer: dom.window.XMLSerializer,
  })
}

function main(): void {
  const options = parseArgs(process.argv.slice(2))
  const input = ensureLocalFile(options.input, '--input')
  const svg = ensureLocalFile(options.svg, '--svg')
  const report = ensureLocalFile(options.report, '--report')
  const png = options.png ? ensureLocalFile(options.png, '--png') : undefined
  const browser = options.browser ? ensureLocalFile(options.browser, '--browser') : undefined
  const positions = options.positions ? ensureLocalFile(options.positions, '--positions') : undefined
  const extension = extname(input).toLowerCase()

  if (!existsSync(input)) throw new Error('No existe el archivo KTR/KJB de entrada.')
  if (extension !== '.ktr' && extension !== '.kjb') throw new Error('La entrada debe ser .ktr o .kjb.')
  assertDistinctPaths([
    { label: '--input', path: input },
    ...(browser ? [{ label: '--browser', path: browser }] : []),
    { label: '--svg', path: svg },
    { label: '--report', path: report },
    ...(png ? [{ label: '--png', path: png }] : []),
    ...(positions ? [{ label: '--positions', path: positions }] : []),
  ])

  ensureWritable(svg, options.force)
  ensureWritable(report, options.force)
  if (png) ensureWritable(png, options.force)
  if (positions) ensureWritable(positions, options.force)

  const bytes = readFileSync(input)
  const sha256 = createHash('sha256').update(bytes).digest('hex')
  installDomGlobals()
  const graph = parseKettleFile(bytes.toString('utf8'), basename(input))
  const rendered = renderHeadlessDiagram(graph, {
    sourceBasename: basename(input),
    sourceSha256: sha256,
    layout: options.layout,
    ...(options.viewport ? { viewport: options.viewport } : {}),
  })

  atomicWrite(svg, rendered.svg)
  atomicWrite(report, `${JSON.stringify(rendered.report, null, 2)}\n`)
  if (positions) {
    atomicWrite(positions, `${JSON.stringify({
      source: { basename: basename(input), sha256 },
      layout: options.layout,
      positions: rendered.positions,
    }, null, 2)}\n`)
  }
  if (png && browser) {
    renderPng({
      browser,
      svg,
      png,
      width: rendered.width,
      height: rendered.height,
    })
  }

  process.stdout.write([
    `PASS export headless: ${basename(input)}`,
    `sha256=${sha256}`,
    `nodes=${rendered.report.graph.nodes}`,
    `edges=${rendered.report.graph.enabledEdges}`,
    `blocking_collisions=${rendered.report.blockingCollisionCount}`,
    `warnings=${rendered.report.warningCollisionCount}`,
    `layout=${options.layout}`,
    `svg=${basename(svg)}`,
    `report=${basename(report)}`,
    ...(png ? [`png=${basename(png)}`] : []),
    ...(positions ? [`positions=${basename(positions)}`] : []),
  ].join(' ') + '\n')

  if (options.failOnCollisions && rendered.report.status !== 'PASS') {
    process.exitCode = 2
  }
}

try {
  main()
} catch (error) {
  const message = error instanceof Error ? error.message : 'Error desconocido.'
  process.stderr.write(`ERROR export headless: ${message}\n`)
  process.exitCode = 1
}
