/** 名单对比功能的类型定义 */

/** 名单对比模式：与系统数据对比 / 与外部数据对比 */
export type NameListCompareModeType = 'system' | 'external'

/** 名单对比数据源标识：对照列 / 数据源 A / 数据源 B */
export type NameListCompareSourceKeyType = 'comparison' | 'sourceA' | 'sourceB'

/** 名单对比数据源类型：系统数据 / Excel / 粘贴文本 */
export type NameListCompareSourceKindType = 'system' | 'excel' | 'paste'

/** 名单对比单元格值类型 */
export type NameListCompareCellValueType = string | number | boolean | null | undefined

/** 名单对比中的行数据 */
export interface NameListCompareRowType {
  /** 以列名为 key 的单元格值 */
  [key: string]: NameListCompareCellValueType
}

/** 已导入的外部数据源 */
export interface NameListCompareImportedSourceType {
  /** 数据源标识 */
  key: NameListCompareSourceKeyType
  /** 数据源类型 */
  kind: NameListCompareSourceKindType
  /** 数据源显示名称 */
  label: string
  /** 表头列表 */
  headers: string[]
  /** 行数据列表 */
  rows: NameListCompareRowType[]
  /** 姓名列标识 */
  nameColumn: string
}

/** 名单条目（标准化后的姓名） */
export interface NameListCompareEntryType {
  /** 原始姓名 */
  name: string
  /** 标准化后的姓名（去除空格等，用于匹配） */
  normalizedName: string
  /** 在原始列表中的索引 */
  originalIndex: number
}

/** 对比结果视图行 */
export interface NameListCompareViewRowType {
  /** 基准名单姓名 */
  baselineName: string
  /** 对照名单姓名 */
  comparisonName: string
  /** 是否匹配成功 */
  matched: boolean
}

/** 对比统计摘要 */
export interface NameListCompareSummaryType {
  /** 基准名单人数 */
  baselineCount: number
  /** 对照名单人数 */
  comparisonCount: number
  /** 匹配成功人数 */
  matchedCount: number
  /** 仅存在于基准名单的人数 */
  baselineOnlyCount: number
  /** 仅存在于对照名单的人数 */
  comparisonOnlyCount: number
}

/** 按匹配状态分组的学生名单 */
export interface NameListCompareGroupsType {
  /** 仅存在于基准名单的姓名列表 */
  baselineOnly: string[]
  /** 仅存在于对照名单的姓名列表 */
  comparisonOnly: string[]
  /** 匹配成功的姓名列表 */
  matched: string[]
}

/** 名单对比完整结果 */
export interface NameListCompareResultType {
  /** 对比结果行列表 */
  rows: NameListCompareViewRowType[]
  /** 统计摘要 */
  summary: NameListCompareSummaryType
  /** 按匹配状态分组的结果 */
  groups: NameListCompareGroupsType
}
