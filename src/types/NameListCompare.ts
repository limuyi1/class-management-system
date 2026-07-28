/** 名单对比模式：与系统数据对比 / 与外部数据对比 */
export type NameListCompareModeType = 'system' | 'external'

/** 名单对比数据源标识：对照列 / 数据源 A / 数据源 B */
export type NameListCompareSourceKeyType = 'comparison' | 'sourceA' | 'sourceB'

/** 名单对比数据源类型：系统数据 / Excel / 粘贴文本 */
export type NameListCompareSourceKindType = 'system' | 'excel' | 'paste'

export type NameListCompareCellValueType = string | number | boolean | null | undefined

/** 名单对比中的行数据 */
export interface NameListCompareRowType {
  [key: string]: NameListCompareCellValueType
}

/** 已导入的外部数据源 */
export interface NameListCompareImportedSourceType {
  key: NameListCompareSourceKeyType
  kind: NameListCompareSourceKindType
  label: string
  headers: string[]
  rows: NameListCompareRowType[]
  nameColumn: string
}

/** 名单条目（标准化后的姓名） */
export interface NameListCompareEntryType {
  name: string
  normalizedName: string
  originalIndex: number
}

/** 对比结果视图行 */
export interface NameListCompareViewRowType {
  baselineName: string
  comparisonName: string
  matched: boolean
}

/** 对比统计摘要 */
export interface NameListCompareSummaryType {
  baselineCount: number
  comparisonCount: number
  matchedCount: number
  baselineOnlyCount: number
  comparisonOnlyCount: number
}

/** 按匹配状态分组的学生名单 */
export interface NameListCompareGroupsType {
  baselineOnly: string[]
  comparisonOnly: string[]
  matched: string[]
}

/** 名单对比完整结果 */
export interface NameListCompareResultType {
  rows: NameListCompareViewRowType[]
  summary: NameListCompareSummaryType
  groups: NameListCompareGroupsType
}
