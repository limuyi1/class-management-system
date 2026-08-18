/**
 * 评语增量导入工具
 * 将 Excel 评语数据按姓名匹配到现有学生，支持填充空值 / 覆盖已有两种策略
 */
import { NAME_PROP } from '@/constants'

import type { ExcelRowType } from '@/utils/scoreImportUtil'
import type { CommentImportStrategyType } from '@/types/StudentImport'
import type { StudentDataType } from '@/types/StudentData'

/** 评语增量导入统计结果 */
export interface CommentImportStatsType {
  matchedStudentCount: number
  filledCommentCount: number
  overwrittenCommentCount: number
  skippedCommentCount: number
  ignoredStudentCount: number
  duplicateStudentCount: number
}

/** 评语增量导入参数 */
interface CommentImportOptionsType {
  rows: ExcelRowType[]
  existingStudents: StudentDataType[]
  nameColumn: string
  commentColumn: string
  strategy: CommentImportStrategyType
}

/** 将任意值转为去除首尾空格后的文本，空值转空串 */
const normalizeText = (value: unknown): string => String(value ?? '').trim()

/** 统计列表中重复出现的文本，返回重复项集合 */
const getDuplicateNames = (values: string[]): Set<string> => {
  const counts = new Map<string, number>()
  values.filter(Boolean).forEach((value) => counts.set(value, (counts.get(value) || 0) + 1))
  return new Set(
    Array.from(counts.entries())
      .filter(([, count]) => count > 1)
      .map(([name]) => name)
  )
}

/**
 * 预估覆盖模式会替换的已有评语数量，用于在真正写入前给出二次确认。
 * Excel 空白评语不会被计入，避免空数据覆盖教师已经填写的内容。
 * @param options - 导入参数
 * @returns 将被覆盖的评语数量
 */
export const countOverwrittenComments = (options: CommentImportOptionsType): number => {
  const duplicateSystemNames = getDuplicateNames(
    options.existingStudents.map((student) => normalizeText(student[NAME_PROP]))
  )
  const duplicateExcelNames = getDuplicateNames(
    options.rows.map((row) => normalizeText(row[options.nameColumn]))
  )
  const existingByName = new Map(
    options.existingStudents
      .filter((student) => !duplicateSystemNames.has(normalizeText(student[NAME_PROP])))
      .map((student) => [normalizeText(student[NAME_PROP]), student])
  )

  return options.rows.reduce((count, row) => {
    const name = normalizeText(row[options.nameColumn])
    if (duplicateExcelNames.has(name)) return count
    const comment = normalizeText(row[options.commentColumn])
    const existingStudent = existingByName.get(name)
    return existingStudent?.comment?.trim() && comment ? count + 1 : count
  }, 0)
}

/**
 * 按姓名精确匹配并导入期末评语。
 * 未匹配姓名直接忽略；无论采用何种策略，Excel 空白单元格都不会覆盖原评语。
 * @param options - 导入参数
 * @returns 更新后的学生列表与导入统计
 */
export const buildIncrementalCommentImport = (
  options: CommentImportOptionsType
): { students: StudentDataType[]; stats: CommentImportStatsType } => {
  const duplicateSystemNames = getDuplicateNames(
    options.existingStudents.map((student) => normalizeText(student[NAME_PROP]))
  )
  const duplicateExcelNames = getDuplicateNames(
    options.rows.map((row) => normalizeText(row[options.nameColumn]))
  )
  const existingNames = new Set(
    options.existingStudents
      .map((student) => normalizeText(student[NAME_PROP]))
      .filter((name) => Boolean(name) && !duplicateSystemNames.has(name))
  )
  const rowsByName = new Map<string, ExcelRowType>()
  let ignoredStudentCount = 0
  let duplicateStudentCount = 0

  options.rows.forEach((row) => {
    const name = normalizeText(row[options.nameColumn])
    if (!name) return
    if (duplicateSystemNames.has(name) || duplicateExcelNames.has(name)) {
      duplicateStudentCount += 1
      return
    }
    if (!existingNames.has(name)) {
      ignoredStudentCount += 1
      return
    }
    rowsByName.set(name, row)
  })

  const stats: CommentImportStatsType = {
    matchedStudentCount: rowsByName.size,
    filledCommentCount: 0,
    overwrittenCommentCount: 0,
    skippedCommentCount: 0,
    ignoredStudentCount,
    duplicateStudentCount
  }

  // 只按 Excel 姓名匹配更新评语，始终沿用系统学生数组的当前顺序，避免导入后重排表格。
  const students = options.existingStudents.map((student) => {
    const name = normalizeText(student[NAME_PROP])
    const row = rowsByName.get(name)
    if (!row) return { ...student }

    const incomingComment = normalizeText(row[options.commentColumn])
    const existingComment = student.comment?.trim() || ''
    if (!incomingComment) {
      stats.skippedCommentCount += 1
      return { ...student }
    }

    if (existingComment && options.strategy === 'fill-empty') {
      stats.skippedCommentCount += 1
      return { ...student }
    }

    if (existingComment) {
      stats.overwrittenCommentCount += 1
    } else {
      stats.filledCommentCount += 1
    }

    return { ...student, comment: incomingComment }
  })

  return { students, stats }
}
