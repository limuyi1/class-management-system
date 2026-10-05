import { getValidScore } from '@/utils/scoreValueUtil'

import type { StudentDataType } from '@/types/StudentData'
import type { ExamPrintAnalysisType } from '@/types/ExamPrint'
import type { ExamPrintPageType } from '@/types/ExamPrint'

/** 仅统计指定的本期列，缺失、无效分和真实零分分开处理。 */
export function buildExamPrintAnalysis(
  students: StudentDataType[],
  prop: string,
  fullMark: number
): ExamPrintAnalysisType {
  const mark = Number.isFinite(fullMark) && fullMark > 0 ? fullMark : 100
  const rows = students
    .filter((student) => !student.disabled && !student.departed)
    .map((student) => {
      const score = getValidScore(student[prop])
      return {
        id: student.studentId,
        name: String(student.name || ''),
        score: score !== null && score >= 0 && score <= mark ? score : null
      }
    })
  const scores = rows.flatMap((row) => (row.score === null ? [] : [row.score]))
  const boundaries = [90, 80, 70, 60, 0]
  return {
    total: rows.length,
    valid: scores.length,
    missing: rows.length - scores.length,
    fullMark: mark,
    average: scores.length ? scores.reduce((sum, score) => sum + score, 0) / scores.length : null,
    passRate: scores.length
      ? (scores.filter((score) => score / mark >= 0.6).length / scores.length) * 100
      : null,
    excellentRate: scores.length
      ? (scores.filter((score) => score / mark >= 0.8).length / scores.length) * 100
      : null,
    bands: boundaries.map((min, index) => ({
      label: index === 0 ? '90-100%' : `${min}-${boundaries[index - 1]}%（不含上限）`,
      count: scores.filter(
        (score) =>
          (score / mark) * 100 >= min &&
          (index === 0 || (score / mark) * 100 < boundaries[index - 1])
      ).length
    })),
    students: rows
  }
}

/** 分页仅返回数据，设置变化时不创建图片；明细保留连续编号。 */
export function paginateExamPrint(
  analysis: ExamPrintAnalysisType,
  includeStudents: boolean
): ExamPrintPageType[] {
  const pages: ExamPrintPageType[] = [{ kind: 'summary', page: 1, pageCount: 1, rows: [] }]
  if (includeStudents) {
    for (let offset = 0; offset < analysis.students.length; offset += 28)
      pages.push({
        kind: 'students',
        page: pages.length + 1,
        pageCount: 1,
        rows: analysis.students
          .slice(offset, offset + 28)
          .map((student, index) => ({ ...student, number: offset + index + 1 }))
      })
  }
  for (const page of pages) page.pageCount = pages.length
  return pages
}
