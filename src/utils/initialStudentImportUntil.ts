import { buildInitialScoreImport } from '@/utils/scoreImportUntil'
import { NAME_PROP } from '@/types/Constants'

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
  const rowsByName = new Map(
    options.rows.map((row) => [String(row[options.nameColumn] ?? '').trim(), row])
  )
  let commentCount = 0

  const students = scoreResult.students.map((student) => {
    if (!options.commentColumn) return student

    const name = String(student[NAME_PROP] ?? '').trim()
    const comment = String(rowsByName.get(name)?.[options.commentColumn] ?? '').trim()
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
