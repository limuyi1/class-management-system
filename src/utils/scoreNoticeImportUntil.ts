import { pinyin } from 'pinyin-pro'

import {
  ScoreNoticeCommentStatusEnum,
  ScoreNoticeModeEnum,
  type ScoreNoticeImportResultType,
  type ScoreNoticeSubjectType
} from '@/types/ScoreNotice'
import {
  convertScoreToGrade,
  detectScoreNoticeMode,
  getDefaultGradeRule,
  normalizeGradeValue
} from '@/utils/scoreNoticeGradeUntil'

import type { ExcelRowType } from '@/utils/xlsxUntil'
import type { StudentDataType } from '@/types/StudentData'

/** 使用列名与列序号生成稳定 ID，允许 Excel 中出现同名科目列。 */
const createSubjectId = (label: string, index: number): string => {
  const base = pinyin(label, { toneType: 'num', type: 'array' }).join('_') || `subject_${index}`
  return `${base}_${index}`
}

const normalizeName = (value: unknown): string => String(value ?? '').trim()

/**
 * 将 Excel 行转换为成绩通知的独立数据结构。
 *
 * 重名学生会被跳过，避免无法可靠关联历史表现或覆盖导入后的评语。
 */
export const buildScoreNoticeImport = (options: {
  rows: ExcelRowType[]
  nameColumn: string
  subjectColumns: string[]
  requestedMode?: ScoreNoticeModeEnum
  systemStudents?: StudentDataType[]
}): ScoreNoticeImportResultType => {
  const sampledValues = options.subjectColumns.flatMap((column) =>
    options.rows.slice(0, 20).map((row) => row[column])
  )
  const sourceMode = options.requestedMode ?? detectScoreNoticeMode(sampledValues)
  const subjects: ScoreNoticeSubjectType[] = options.subjectColumns.map((label, index) => ({
    id: createSubjectId(label, index),
    label,
    sourceColumn: label,
    rule: getDefaultGradeRule(label)
  }))
  const nameCounts = new Map<string, number>()
  options.rows.forEach((row) => {
    const name = normalizeName(row[options.nameColumn])
    if (name) nameCounts.set(name, (nameCounts.get(name) || 0) + 1)
  })
  const duplicateNames = Array.from(nameCounts.entries())
    .filter(([, count]) => count > 1)
    .map(([name]) => name)
  const duplicateSet = new Set(duplicateNames)
  const systemStudentByName = new Map(
    (options.systemStudents ?? []).map((student) => [
      String(student.xing4_ming2 || '').trim(),
      student
    ])
  )
  let invalidCellCount = 0

  // 逐行映射 Excel，不按姓名、成绩或状态排序；通知预览和学生列表均沿用导入文件的原始顺序。
  const students = options.rows
    .map((row, rowIndex) => {
      const name = normalizeName(row[options.nameColumn])
      if (!name || duplicateSet.has(name)) return null
      const rawValues: Record<string, string | number | null> = {}
      const gradeValues: Record<string, string | null> = {}

      subjects.forEach((subject) => {
        const rawValue = row[subject.sourceColumn]
        const normalizedRaw =
          typeof rawValue === 'number' || typeof rawValue === 'string' ? rawValue : null
        rawValues[subject.id] = normalizedRaw
        const grade =
          sourceMode === ScoreNoticeModeEnum.Grade
            ? normalizeGradeValue(rawValue)
            : convertScoreToGrade(rawValue, subject.rule)
        gradeValues[subject.id] = grade
        const hasValue = rawValue !== null && rawValue !== undefined && rawValue !== ''
        if (hasValue && !grade) invalidCellCount += 1
      })

      const systemStudent = systemStudentByName.get(name)
      const hasAnyGrade = Object.values(gradeValues).some(Boolean)
      return {
        id: systemStudent?.studentId || `notice_${Date.now()}_${rowIndex}`,
        sourceStudentId: systemStudent?.studentId,
        name,
        rawValues,
        gradeValues,
        comment: '',
        commentStatus: hasAnyGrade
          ? ScoreNoticeCommentStatusEnum.Pending
          : ScoreNoticeCommentStatusEnum.Missing
      }
    })
    .filter((student): student is NonNullable<typeof student> => student !== null)

  return { sourceMode, subjects, students, invalidCellCount, duplicateNames }
}

export const recalculateNoticeGrades = (options: {
  subjects: ScoreNoticeSubjectType[]
  students: ScoreNoticeImportResultType['students']
}): ScoreNoticeImportResultType['students'] => {
  return options.students.map((student) => ({
    ...student,
    gradeValues: options.subjects.reduce<Record<string, string | null>>((result, subject) => {
      result[subject.id] = convertScoreToGrade(student.rawValues[subject.id], subject.rule)
      return result
    }, {})
  }))
}
