/**
 * 成绩导入工具
 * 负责 Excel 成绩数据的解析、校验、冲突检测和增量合并导入
 */
import { pinyin } from 'pinyin-pro'

import { NAME_PROP } from '@/constants'
import { createStudentId } from '@/utils/studentUtil'
import type { SettingType } from '@/types/Setting'
import type { StudentDataType } from '@/types/StudentData'

/** Excel 单元格值类型，允许空值以区分空单元格 */
export type ExcelCellValueType = string | number | boolean | null | undefined
/** 以表头字段为 key 的 Excel 数据行 */
export type ExcelRowType = Record<string, ExcelCellValueType>
/** 成绩列冲突处理策略：覆盖或跳过 */
export type ConflictActionType = 'overwrite' | 'skip'

/** 成绩值解析结果 */
export interface ScoreValueResultType {
  value: number | null
  invalid: boolean
}

/** 成绩导入统计 */
export interface ScoreImportStatsType {
  invalidScoreCount: number
  ignoredStudentCount: number
  duplicateStudentCount: number
  addedColumnCount: number
  overwrittenColumnCount: number
  skippedColumnCount: number
}

/** 初次成绩导入结果（含表头和学生数据） */
export interface InitialScoreImportResultType {
  headers: SettingType[]
  students: StudentDataType[]
  invalidScoreCount: number
  duplicateStudentCount: number
}

/** 增量成绩导入结果（含表头、学生数据及统计信息） */
export interface IncrementalScoreImportResultType {
  headers: SettingType[]
  students: StudentDataType[]
  stats: ScoreImportStatsType
}

/** 规范化姓名字符串：空值转空串并去除首尾空格 */
const normalizeName = (value: ExcelCellValueType): string => {
  if (value === null || value === undefined) return ''
  return String(value).trim()
}

/** 根据列名生成拼音 prop（带声调数字），拼音失败时回退为原始列名 */
const createScoreProp = (label: string): string => {
  const prop = pinyin(label, { toneType: 'num', type: 'array' }).join('_')
  return prop || label
}

/** 根据列名创建成绩列表头配置 */
const createHeader = (label: string): SettingType => ({
  prop: createScoreProp(label),
  label,
  disabled: false
})

/**
 * 解析单个成绩单元格值。
 * @param value - 单元格值
 * @returns value 为解析后的数字（无效或空为 null），invalid 标识是否为非法数据
 */
export const parseScoreValue = (value: ExcelCellValueType): ScoreValueResultType => {
  if (value === null || value === undefined || value === '') {
    return { value: null, invalid: false }
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? { value, invalid: false } : { value: null, invalid: true }
  }

  if (typeof value === 'string') {
    const trimmedValue = value.trim()
    if (!trimmedValue) {
      return { value: null, invalid: false }
    }
    const parsedValue = Number(trimmedValue)
    return Number.isFinite(parsedValue)
      ? { value: parsedValue, invalid: false }
      : { value: null, invalid: true }
  }

  return { value: null, invalid: true }
}

/**
 * 查找数据行中重复出现的姓名。
 * @param rows - 数据行数组（Excel 行或学生数据）
 * @param nameKey - 姓名所在的字段名
 * @returns 重复的姓名列表
 */
export const findDuplicateNames = (
  rows: Array<ExcelRowType | StudentDataType>,
  nameKey: string
): string[] => {
  const nameCount = new Map<string, number>()

  rows.forEach((row) => {
    const name = normalizeName(row[nameKey] as ExcelCellValueType)
    if (!name) return
    nameCount.set(name, (nameCount.get(name) || 0) + 1)
  })

  return Array.from(nameCount.entries())
    .filter(([, count]) => count > 1)
    .map(([name]) => name)
}

/** 将重复姓名集合包装为 Set，便于 O(1) 判重 */
const getDuplicateNameSet = (
  rows: Array<ExcelRowType | StudentDataType>,
  nameKey: string
): Set<string> => new Set(findDuplicateNames(rows, nameKey))

/**
 * 找出与已有表头名称冲突的待导入列。
 * @param selectedColumns - 用户选择的导入列名
 * @param existingHeaders - 已存在的成绩列表头
 * @returns 存在名称冲突的列名列表
 */
export const getConflictLabels = (
  selectedColumns: string[],
  existingHeaders: SettingType[]
): string[] => {
  const existingLabelSet = new Set(existingHeaders.map((header) => header.label))
  return selectedColumns.filter((column) => existingLabelSet.has(column))
}

/**
 * 首次导入学生名单及成绩，为每个学生生成 studentId 并跳过重名/空名行。
 * @param options - 行数据、姓名列与成绩列
 * @returns 表头、学生数据及异常统计
 */
export const buildInitialScoreImport = (options: {
  rows: ExcelRowType[]
  nameColumn: string
  scoreColumns: string[]
}): InitialScoreImportResultType => {
  const headers = options.scoreColumns.map(createHeader)
  let invalidScoreCount = 0
  let duplicateStudentCount = 0
  const duplicateNames = getDuplicateNameSet(options.rows, options.nameColumn)

  const students = options.rows
    .map((row) => {
      const name = normalizeName(row[options.nameColumn])
      if (!name) return null
      if (duplicateNames.has(name)) {
        duplicateStudentCount += 1
        return null
      }

      const student = headers.reduce(
        (acc, header) => {
          const scoreResult = parseScoreValue(row[header.label])
          if (scoreResult.invalid) {
            invalidScoreCount += 1
          }
          acc[header.prop] = scoreResult.value
          return acc
        },
        { studentId: createStudentId(), [NAME_PROP]: name } as StudentDataType
      )

      return student
    })
    .filter((student): student is StudentDataType => student !== null)

  return {
    headers,
    students,
    invalidScoreCount,
    duplicateStudentCount
  }
}

/**
 * 增量导入成绩：按姓名匹配现有学生，根据冲突策略新增或覆盖成绩列。
 * @param options - 行数据、现有学生与表头、姓名列、选中列及冲突策略
 * @returns 合并后的表头、学生数据及统计信息
 */
export const buildIncrementalScoreImport = (options: {
  rows: ExcelRowType[]
  existingStudents: StudentDataType[]
  existingHeaders: SettingType[]
  nameColumn: string
  selectedColumns: string[]
  conflictActions: Record<string, ConflictActionType>
}): IncrementalScoreImportResultType => {
  const existingHeaderByLabel = new Map(
    options.existingHeaders.map((header) => [header.label, header])
  )
  const headers = [...options.existingHeaders]
  const columnHeaders = new Map<string, SettingType>()
  const stats: ScoreImportStatsType = {
    invalidScoreCount: 0,
    ignoredStudentCount: 0,
    duplicateStudentCount: 0,
    addedColumnCount: 0,
    overwrittenColumnCount: 0,
    skippedColumnCount: 0
  }

  options.selectedColumns.forEach((column) => {
    const existingHeader = existingHeaderByLabel.get(column)
    if (existingHeader) {
      if (options.conflictActions[column] === 'overwrite') {
        columnHeaders.set(column, existingHeader)
        stats.overwrittenColumnCount += 1
      } else {
        stats.skippedColumnCount += 1
      }
      return
    }

    const header = createHeader(column)
    headers.push(header)
    columnHeaders.set(column, header)
    stats.addedColumnCount += 1
  })

  const duplicateSystemNames = getDuplicateNameSet(options.existingStudents, NAME_PROP)
  const duplicateExcelNames = getDuplicateNameSet(options.rows, options.nameColumn)
  const existingNames = new Set(
    options.existingStudents
      .map((student) => normalizeName(student[NAME_PROP] as ExcelCellValueType))
      .filter((name) => Boolean(name) && !duplicateSystemNames.has(name))
  )
  const excelRowsByName = new Map<string, ExcelRowType>()

  options.rows.forEach((row) => {
    const name = normalizeName(row[options.nameColumn])
    if (!name) return
    if (duplicateSystemNames.has(name) || duplicateExcelNames.has(name)) {
      stats.duplicateStudentCount += 1
      return
    }
    if (!existingNames.has(name)) {
      stats.ignoredStudentCount += 1
      return
    }
    excelRowsByName.set(name, row)
  })

  const students = options.existingStudents.map((student) => {
    const name = normalizeName(student[NAME_PROP] as ExcelCellValueType)
    const excelRow = excelRowsByName.get(name)
    if (!excelRow) return { ...student }

    const nextStudent: StudentDataType = { ...student }
    columnHeaders.forEach((header, column) => {
      const scoreResult = parseScoreValue(excelRow[column])
      if (scoreResult.invalid) {
        stats.invalidScoreCount += 1
      }
      nextStudent[header.prop] = scoreResult.value
    })

    return nextStudent
  })

  return {
    headers,
    students,
    stats
  }
}
