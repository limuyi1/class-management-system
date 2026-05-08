export type NameListCompareModeType = 'system' | 'external'

export type NameListCompareSourceKeyType = 'comparison' | 'sourceA' | 'sourceB'

export type NameListCompareSourceKindType = 'system' | 'excel' | 'paste'

export type NameListCompareCellValueType = string | number | boolean | null | undefined

export interface NameListCompareRowType {
  [key: string]: NameListCompareCellValueType
}

export interface NameListCompareImportedSourceType {
  key: NameListCompareSourceKeyType
  kind: NameListCompareSourceKindType
  label: string
  headers: string[]
  rows: NameListCompareRowType[]
  nameColumn: string
}

export interface NameListCompareEntryType {
  name: string
  normalizedName: string
  originalIndex: number
}

export interface NameListCompareViewRowType {
  baselineName: string
  comparisonName: string
  matched: boolean
}

export interface NameListCompareSummaryType {
  baselineCount: number
  comparisonCount: number
  matchedCount: number
  baselineOnlyCount: number
  comparisonOnlyCount: number
}

export interface NameListCompareGroupsType {
  baselineOnly: string[]
  comparisonOnly: string[]
  matched: string[]
}

export interface NameListCompareResultType {
  rows: NameListCompareViewRowType[]
  summary: NameListCompareSummaryType
  groups: NameListCompareGroupsType
}
