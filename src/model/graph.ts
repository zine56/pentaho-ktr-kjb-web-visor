export type KettleKind = 'transformation' | 'job'

export type NodeKind = 'step' | 'entry'

export interface KettleNode {
  /** Unique id within the file; derived from name, disambiguated on duplicates. */
  id: string
  name: string
  /** Step/entry type id, e.g. 'TableInput', 'SPECIAL', 'TRANS'. */
  type: string
  kind: NodeKind
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
}

export interface KettleGraph {
  kind: KettleKind
  name: string
  nodes: KettleNode[]
  edges: KettleEdge[]
}
