import { buildInitialScoreImport } from '@/utils/scoreImportUntil'

import type { ExcelRowType } from '@/utils/scoreImportUntil'
import type { StudentDataType } from '@/types/StudentData'

interface InitialStudentImportOptionsType {
  rows: ExcelRowType[]
  nameColumn: string
  scoreColumns: string[]
  commentColumn?: string
}

/**
 * 首次导入学生名单，并按用户选择同时写入成绩和期末评语。
 * 评语保持文本语义，不经过成绩数字解析；空白评语不会写入学生数据。
 */
export const buildInitialStudentImport = (options: InitialStudentImportOptionsType) => {
  const scoreResult = buildInitialScoreImport(options)
  const validRows = options.rows.filter((row) => String(row[options.nameColumn] ?? '').trim())
  let commentCount = 0

  const students = scoreResult.students.map((student, index) => {
    if (!options.commentColumn) return student

    const comment = String(validRows[index]?.[options.commentColumn] ?? '').trim()
    if (!comment) return student

    commentCount += 1
    return { ...student, comment } as StudentDataType
  })

  return {
    ...scoreResult,
    students,
    commentCount
  }
}
