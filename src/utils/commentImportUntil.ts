import { NAME_PROP } from '@/types/Constants'

import type { ExcelRowType } from '@/utils/scoreImportUntil'
import type { CommentImportStrategyType } from '@/types/StudentImport'
import type { StudentDataType } from '@/types/StudentData'

export interface CommentImportStatsType {
  matchedStudentCount: number
  filledCommentCount: number
  overwrittenCommentCount: number
  skippedCommentCount: number
  ignoredStudentCount: number
}

interface CommentImportOptionsType {
  rows: ExcelRowType[]
  existingStudents: StudentDataType[]
  nameColumn: string
  commentColumn: string
  strategy: CommentImportStrategyType
}

const normalizeText = (value: unknown): string => String(value ?? '').trim()

/**
 * 预估覆盖模式会替换的已有评语数量，用于在真正写入前给出二次确认。
 * Excel 空白评语不会被计入，避免空数据覆盖教师已经填写的内容。
 */
export const countOverwrittenComments = (options: CommentImportOptionsType): number => {
  const existingByName = new Map(
    options.existingStudents.map((student) => [normalizeText(student[NAME_PROP]), student])
  )

  return options.rows.reduce((count, row) => {
    const name = normalizeText(row[options.nameColumn])
    const comment = normalizeText(row[options.commentColumn])
    const existingStudent = existingByName.get(name)
    return existingStudent?.comment?.trim() && comment ? count + 1 : count
  }, 0)
}

/**
 * 按姓名精确匹配并导入期末评语。
 * 未匹配姓名直接忽略；无论采用何种策略，Excel 空白单元格都不会覆盖原评语。
 */
export const buildIncrementalCommentImport = (
  options: CommentImportOptionsType
): { students: StudentDataType[]; stats: CommentImportStatsType } => {
  const existingNames = new Set(
    options.existingStudents.map((student) => normalizeText(student[NAME_PROP])).filter(Boolean)
  )
  const rowsByName = new Map<string, ExcelRowType>()
  let ignoredStudentCount = 0

  options.rows.forEach((row) => {
    const name = normalizeText(row[options.nameColumn])
    if (!name) return
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
    ignoredStudentCount
  }

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
