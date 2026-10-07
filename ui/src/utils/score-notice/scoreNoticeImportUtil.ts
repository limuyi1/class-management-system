/**
 * 成绩通知导入工具
 * 将 Excel 行转换为成绩通知数据，并支持按科目规则重算等级
 */
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
} from '@/utils/score-notice/scoreNoticeGradeUtil'

import type { ExcelRowType } from '@/utils/xlsxUtil'
import type { StudentDataType } from '@/types/StudentData'

/** 使用列名与列序号生成稳定 ID，允许 Excel 中出现同名科目列。 */
const createSubjectId = (label: string, index: number): string => {
  const base = pinyin(label, { toneType: 'num', type: 'array' }).join('_') || `subject_${index}`
  return `${base}_${index}`
}

/** 规范化姓名字符串：空值转空串并去除首尾空格 */
const normalizeName = (value: unknown): string => String(value ?? '').trim()

/**
 * 将 Excel 行转换为成绩通知的独立数据结构。
 *
 * 重名学生会被跳过，避免无法可靠关联历史表现或覆盖导入后的评语。
 * @param options - 导入参数（行数据、姓名列、科目列、模式与系统学生）
 * @returns 成绩通知导入结果
 */
export const buildScoreNoticeImport = (options: {
  rows: ExcelRowType[]
  nameColumn: string
  subjectColumns: string[]
  requestedMode?: ScoreNoticeModeEnum
  systemStudents?: StudentDataType[]
}): ScoreNoticeImportResultType => {
  // 取前 20 行的样本值推断导入模式（等级制/分数制）
  const sampledValues = options.subjectColumns.flatMap((column) =>
    options.rows.slice(0, 20).map((row) => row[column])
  )
  const sourceMode = options.requestedMode ?? detectScoreNoticeMode(sampledValues)
  // 为每个科目生成独立结构并挂载默认等级规则
  const subjects: ScoreNoticeSubjectType[] = options.subjectColumns.map((label, index) => ({
    id: createSubjectId(label, index),
    label,
    sourceColumn: label,
    rule: getDefaultGradeRule(label)
  }))
  // 统计 Excel 中的重名学生，重名行无法可靠关联历史表现，直接跳过
  const nameCounts = new Map<string, number>()
  options.rows.forEach((row) => {
    const name = normalizeName(row[options.nameColumn])
    if (name) nameCounts.set(name, (nameCounts.get(name) || 0) + 1)
  })
  const duplicateNames = Array.from(nameCounts.entries())
    .filter(([, count]) => count > 1)
    .map(([name]) => name)
  const duplicateSet = new Set(duplicateNames)
  // 建立“姓名 -> 系统学生”映射，用于关联 studentId 与历史表现
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
      // 空名与重名行跳过
      if (!name || duplicateSet.has(name)) return null
      const rawValues: Record<string, string | number | null> = {}
      const gradeValues: Record<string, string | null> = {}

      subjects.forEach((subject) => {
        const rawValue = row[subject.sourceColumn]
        const normalizedRaw =
          typeof rawValue === 'number' || typeof rawValue === 'string' ? rawValue : null
        rawValues[subject.id] = normalizedRaw
        // 等级制直接归一化，分数制按科目规则换算等级
        const grade =
          sourceMode === ScoreNoticeModeEnum.Grade
            ? normalizeGradeValue(rawValue)
            : convertScoreToGrade(rawValue, subject.rule)
        gradeValues[subject.id] = grade
        const hasValue = rawValue !== null && rawValue !== undefined && rawValue !== ''
        // 有原始值但换算不出等级时计入非法单元格
        if (hasValue && !grade) invalidCellCount += 1
      })

      // 匹配系统学生以复用 studentId，未匹配时生成临时 ID
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

/**
 * 依据科目规则重新计算所有学生的等级，通常在修改满分/分数线后调用。
 * @param options - 科目列表与学生列表
 * @returns 更新过 gradeValues 的学生列表
 */
export const recalculateNoticeGrades = (options: {
  subjects: ScoreNoticeSubjectType[]
  students: ScoreNoticeImportResultType['students']
}): ScoreNoticeImportResultType['students'] => {
  // 按最新科目规则重算每个学生的等级，保持学生数组原始顺序
  return options.students.map((student) => ({
    ...student,
    gradeValues: options.subjects.reduce<Record<string, string | null>>((result, subject) => {
      result[subject.id] = convertScoreToGrade(student.rawValues[subject.id], subject.rule)
      return result
    }, {})
  }))
}
