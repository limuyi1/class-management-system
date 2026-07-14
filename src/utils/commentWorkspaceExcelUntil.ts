import * as XLSX from 'xlsx'

import { NAME_PROP } from '@/types/Constants'

import type { StudentDataType } from '@/types/StudentData'
import type { ExcelCellValueType } from '@/utils/xlsxUntil'

export const EXCEL_COMMENT_TAG_PROP = '__excel_comment_tags'
export const EXCEL_COMMENT_ROW_PROP = '__excel_comment_row_index'

interface BuildExcelCommentWorkspaceOptionsType {
  rows: ExcelCellValueType[][]
  headerRowIndex: number
  nameColumn: string
  commentColumn?: string
  tagColumn?: string
}

interface ExcelCommentCellUpdateType {
  rowIndex: number
  columnIndex: number
  value: string
}

const normalizeCellText = (value: ExcelCellValueType): string => String(value ?? '').trim()

const buildHeader = (row: ExcelCellValueType[]): string[] =>
  row.map((cell, index) => normalizeCellText(cell) || `UNKNOWN ${index}`)

/**
 * Excel 标签只作为本次评语生成的临时上下文，绝不能写入学生 Store 或系统标签配置。
 * 保留包含空格的完整标签，仅按明确的中英文标点、换行、竖线和斜杠拆分。
 */
export function parseTemporaryCommentTags(value: ExcelCellValueType): string[] {
  const tags = normalizeCellText(value)
    .split(/[、，,；;\n\r|/]+/)
    .map((tag) => tag.trim())
    .filter(Boolean)

  return Array.from(new Set(tags))
}

/**
 * 将 Excel 行转换成页面内存中的临时学生。临时 ID 使用原始行号而不是姓名，
 * 因此外班数据和同名学生都可以独立处理，也不会触发任何系统学生匹配。
 */
export function buildExcelCommentWorkspace(options: BuildExcelCommentWorkspaceOptionsType): {
  students: StudentDataType[]
  skippedEmptyNameCount: number
} {
  const header = buildHeader(options.rows[options.headerRowIndex] || [])
  const nameColumnIndex = header.indexOf(options.nameColumn)
  const commentColumnIndex = options.commentColumn ? header.indexOf(options.commentColumn) : -1
  const tagColumnIndex = options.tagColumn ? header.indexOf(options.tagColumn) : -1
  let skippedEmptyNameCount = 0
  const students: StudentDataType[] = []

  options.rows.slice(options.headerRowIndex + 1).forEach((row, offset) => {
    const rowIndex = options.headerRowIndex + 1 + offset
    const name = normalizeCellText(row[nameColumnIndex])
    if (!name) {
      if (row.some((cell) => normalizeCellText(cell))) skippedEmptyNameCount++
      return
    }

    const tags = tagColumnIndex >= 0 ? parseTemporaryCommentTags(row[tagColumnIndex]) : []
    const comment = commentColumnIndex >= 0 ? normalizeCellText(row[commentColumnIndex]) : ''
    students.push({
      studentId: `excel:${rowIndex}`,
      [NAME_PROP]: name,
      comment: comment || undefined,
      tags: { [EXCEL_COMMENT_TAG_PROP]: tags },
      [EXCEL_COMMENT_ROW_PROP]: rowIndex
    })
  })

  return { students, skippedEmptyNameCount }
}

/**
 * 生成最小单元格更新集：有评语列时覆盖该列，没有时在表尾新增“评语”列。
 * 调用方把这些更新写回原工作簿，以保留其他工作表、列顺序和未处理单元格。
 */
export function buildExcelCommentCellUpdates(options: {
  rows: ExcelCellValueType[][]
  headerRowIndex: number
  commentColumn?: string
  students: StudentDataType[]
}): ExcelCommentCellUpdateType[] {
  const header = buildHeader(options.rows[options.headerRowIndex] || [])
  const selectedColumnIndex = options.commentColumn ? header.indexOf(options.commentColumn) : -1
  const columnIndex = selectedColumnIndex >= 0 ? selectedColumnIndex : header.length
  const updates: ExcelCommentCellUpdateType[] = []

  if (selectedColumnIndex < 0) {
    updates.push({ rowIndex: options.headerRowIndex, columnIndex, value: '评语' })
  }

  options.students.forEach((student) => {
    const rowIndex = student[EXCEL_COMMENT_ROW_PROP]
    if (typeof rowIndex !== 'number') return
    updates.push({ rowIndex, columnIndex, value: student.comment?.trim() || '' })
  })

  return updates
}

export async function exportExcelCommentWorkspace(options: {
  file: File
  fileName: string
  rows: ExcelCellValueType[][]
  headerRowIndex: number
  commentColumn?: string
  students: StudentDataType[]
}): Promise<void> {
  const workbook = XLSX.read(await options.file.arrayBuffer(), { type: 'array', cellDates: true })
  const worksheet = workbook.Sheets[workbook.SheetNames[0]]
  const updates = buildExcelCommentCellUpdates(options)

  updates.forEach((update) => {
    XLSX.utils.sheet_add_aoa(worksheet, [[update.value]], {
      origin: { r: update.rowIndex, c: update.columnIndex }
    })
  })

  const fileNameWithoutExtension = options.fileName.replace(/\.(xlsx|xls)$/i, '')
  XLSX.writeFile(workbook, `${fileNameWithoutExtension}_评语处理结果.xlsx`)
}
