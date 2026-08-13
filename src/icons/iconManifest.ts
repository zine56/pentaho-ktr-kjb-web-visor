// Curated v1 icon manifest mapping Pentaho step/job entry type ids to bundled
// icon filenames. Icons were sourced from the Apache-2.0 `pentaho-kettle`
// repository (ui/src/main/resources/ui/images and
// engine/src/main/resources/org/pentaho/di/images). Any type not listed here
// falls back to a generic step/job icon so a node is never rendered blank.

export const FALLBACK_STEP = 'generic-step.svg'
export const FALLBACK_JOB = 'generic-job.svg'
export const FALLBACK_SPECIAL = 'special.svg'

export const ICON_MAP: Record<string, string> = {
  // Transformation steps
  TableInput: 'TIP.png',
  TableOutput: 'TOP.svg',
  TextFileInput: 'TFI.svg',
  TextFileOutput: 'TFO.svg',
  CSVInput: 'CSV.svg',
  ExcelInput: 'XLI.png',
  ExcelOutput: 'XLO.png',
  SelectValues: 'SEL.svg',
  FilterRows: 'FLT.svg',
  SortRows: 'SRT.svg',
  Dummy: 'DUM.svg',
  RowGenerator: 'GEN.svg',
  GroupBy: 'GRP.svg',
  MemoryGroupBy: 'MGB.svg',
  Calculator: 'CLC.svg',
  Constant: 'CST.svg',
  ExecSQL: 'SQL.svg',
  ExecProcess: 'PRC.svg',
  SystemInfo: 'SYS.svg',
  GetVariable: 'GVA.svg',
  SetVariable: 'SVA.svg',
  Update: 'UPD.svg',
  InsertUpdate: 'INU.svg',
  DatabaseJoin: 'DBJ.svg',
  DatabaseLookup: 'DLR.svg',
  DimensionLookup: 'DIM.svg',
  SplitFields: 'SPL.svg',
  ConcatFields: 'CFJ.svg',
  ValueMapper: 'VMAP.svg',
  StreamLookup: 'SLU.svg',
  MergeJoin: 'MJOIN.svg',
  MergeRows: 'MRG.svg',
  SynchronizeAfterMerge: 'SAM.svg',
  UniqueRows: 'UNQ.svg',
  AddSequence: 'SEQ.svg',
  SwitchCase: 'SWC.svg',
  ReplaceString: 'RPL.svg',
  StringOperations: 'STR.svg',
  WriteToLog: 'WTL.svg',
  Normaliser: 'NRM.svg',
  Mail: 'MAIL.svg',
  HTTP: 'HTP.svg',
  Rest: 'REST.svg',
  JsonInput: 'JSI.svg',
  JsonOutput: 'JSO.svg',
  XMLOutput: 'XOU.svg',
  XMLJoin: 'XJN.svg',
  Flattener: 'FLA.svg',
  Mapping: 'MAP.svg',
  XSLT: 'XSLT.svg',
  AggregateRows: 'AGG.png',
  MailInput: 'GETPOP.svg',
  MondrianInput: 'MON.svg',
  S3CSVINPUT: 'S3I.svg',
  XMLInputStream: 'xml_input_stream.svg',
  AddXML: 'add_xml.svg',

  // Job entries
  SPECIAL: FALLBACK_SPECIAL,
  TRANS: 'TRN.svg',
  JOB: 'JOB.svg',
  SQL: 'SQL.svg',
  SHELL: 'SHL.svg',
  FTP: 'FTP.png',
  FTP_PUT: 'PFTP.svg',
  FTP_DELETE: 'FTPD.svg',
  MAIL: 'MAIL.svg',
  DELAY: 'DLT.svg',
  SUCCESS: 'SUC.svg',
  COPY_FILES: 'CPY.svg',
  MOVE_FILES: 'MVF.svg',
  ZIP_FILE: 'ZIP.svg',
  UNZIP_FILE: 'UZP.svg',
  FILE_EXISTS: 'FEX.svg',
  XSD_VALIDATOR: 'XSD.svg',
  DTD_VALIDATOR: 'DTD.svg',
  XML_WELL_FORMED: 'XFC.svg',
}

export function resolveIconFile(type: string, kind: 'step' | 'entry'): string {
  if (kind === 'entry' && type === 'SPECIAL') return FALLBACK_SPECIAL
  const file = ICON_MAP[type]
  if (file) return file
  return kind === 'entry' ? FALLBACK_JOB : FALLBACK_STEP
}
