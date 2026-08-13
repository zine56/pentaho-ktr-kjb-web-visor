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

## Development

```bash
npm install
npm run dev      # start the dev server
npm run test     # run the unit + component tests
npm run build    # produce a static production bundle
```

## License & attribution

Step/job icons were sourced from the [pentaho-kettle](https://github.com/pentaho/pentaho-kettle)
repository (Apache License 2.0). The generic fallback icons in this repository
are original. This project is provided as-is for viewing Kettle files; it does
not edit, run, or persist transformations or jobs.
