export type KettleKind = 'transformation' | 'job'

export type NodeKind = 'step' | 'entry'

export interface KettleNode {
  /** Unique id within the file; derived from name, disambiguated on duplicates. */
  id: string
  /** Stable internal identifier for code-level references, independent of visible name/id display. */
  uid: string
  name: string
  /** Step/entry type id, e.g. 'TableInput', 'SPECIAL', 'TRANS'. */
  type: string
  kind: NodeKind
  /** Raw node configuration captured from the source XML. */
  configXml?: string
  /** From <GUI><xloc>, when present. */
  x?: number
  /** From <GUI><yloc>, when present. */
  y?: number
  /** From <GUI><draw>, defaults true. */
  draw?: boolean
}

export interface KettleEdge {
  id: string
  from: string
  to: string
  enabled: boolean
  /** Job hops only. */
  evaluation?: boolean
  /** Job hops only. */
  unconditional?: boolean
  /** Job hops only. True when the hop is configured as an error handler. */
  errorHandler?: boolean
}

export interface KettleNote {
  /** Stable identifier derived from the note order in the source file. */
  id: string
  text: string
  x: number
  y: number
  width: number
  height: number
  fontName?: string
  fontSize?: number
  fontBold?: boolean
  fontItalic?: boolean
  fontColor?: string
  backgroundColor?: string
  borderColor?: string
  drawShadow?: boolean
}

export interface KettleGraph {
  kind: KettleKind
  name: string
  nodes: KettleNode[]
  edges: KettleEdge[]
  notes: KettleNote[]
}
