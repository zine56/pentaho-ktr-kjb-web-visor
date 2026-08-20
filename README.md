# Pentaho KTR/KJB Web Visor

A read-only web viewer for Pentaho Data Integration (Kettle) files. Open a local
`.ktr` transformation or `.kjb` job and it renders the flow as an interactive
graph, using Pentaho's own step/entry icons.

## Features

- Load a `.ktr` or `.kjb` via the file picker or drag-and-drop.
- Parses Kettle XML and draws every step/job entry as a labeled node with its
  Pentaho icon.
- Draws hops as edges, with disabled hops shown dashed.
- Preserves Spoon's original layout (`<GUI><xloc>/<yloc>`) when present, and
  falls back to a Dagre auto-layout otherwise.
- Pan / zoom / minimap navigation.
- Unknown step/entry types render with a generic fallback icon (never blank).
- Headless diagnostic SVG/PNG export with complete labels and a machine-readable
  collision report, without starting a server.

## Headless layout diagnostics

The headless exporter reads one local `.ktr`/`.kjb`, preserves its Spoon
coordinates and creates a self-contained SVG plus a JSON report. The diagnostic
view uses conservative label footprints, orthogonal hops and highlights
node/label collisions. It serializes the graph name, visible step names/types
and note text, so those labels must be reviewed before sharing. It does not
serialize `configXml`, inject the absolute input path or add timestamps or
external resources.

```powershell
npm run export:headless -- `
  --input "C:\path\flow.ktr" `
  --svg "C:\output\flow-layout.svg" `
  --report "C:\output\flow-layout.json"
```

An optional PNG can be rasterized locally with an installed Chromium browser:

```powershell
npm run export:headless -- `
  --input "C:\path\flow.ktr" `
  --svg "C:\output\flow-layout.svg" `
  --report "C:\output\flow-layout.json" `
  --png "C:\output\flow-layout.png" `
  --browser "C:\Program Files\Google\Chrome\Application\chrome.exe"
```

Use `--fail-on-collisions` as a fail-closed automated gate: both blocking
collisions and visual warnings reject the render. Use `--force` only when an
existing diagnostic artifact is intentionally being regenerated. Input,
browser and output paths must all identify different local files. The SVG is
the canonical deterministic artifact; PNG bytes may vary with browser, OS and
installed fonts. Both formats contain visible step and note text, so review
them before sharing.

To inspect a conservative Dagre proposal without changing the KTR, add
`--layout dagre --positions proposed-positions.json`. The JSON contains only
step ids, names and suggested `xloc`/`yloc`; applying those coordinates remains
an explicit, separate operation.

## Development

```bash
npm install
npm run dev      # start the dev server
npm run test     # run the unit + component tests
npm run typecheck
npm run build    # produce a static production bundle
```

## License & attribution

Step/job icons were sourced from the [pentaho-kettle](https://github.com/pentaho/pentaho-kettle)
repository (Apache License 2.0). The generic fallback icons in this repository
are original. This project is provided as-is for viewing Kettle files; it does
not edit, run, or persist transformations or jobs.
