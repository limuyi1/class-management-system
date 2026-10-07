import { readScoreState } from './scoreProjection.js'
import { BusinessError } from './errors.js'
import type { AccessContextType, DatabaseType } from '../types/Account.js'
/** 测评打印的统计在服务端完成，只使用本期有效名单与原始分数。 */
export function readExamPrint(
  database: DatabaseType,
  context: AccessContextType,
  workspaceId: string,
  assessmentId: string,
  requestId: string
) {
  const state = readScoreState(database, context, workspaceId, requestId),
    unit = state.assessments.find((row) => row.id === assessmentId && !row.disabled)
  if (!unit) throw new BusinessError(404, 'NOT_FOUND', '测评不存在')
  const fullMark = unit.fullMark ?? state.workspace.scoreFullMark
  const students = state.students
    .filter((row) => !row.disabled && !row.departed)
    .map((student) => ({
      id: student.studentId,
      name: student.name,
      score:
        state.scores.find(
          (row) => row.studentId === student.studentId && row.assessmentId === assessmentId
        )?.value ?? null
    }))
  const scores = students.flatMap((row) => (row.score === null ? [] : [row.score])),
    boundaries = [90, 80, 70, 60, 0]
  return {
    total: students.length,
    valid: scores.length,
    missing: students.length - scores.length,
    fullMark,
    average: scores.length ? scores.reduce((sum, value) => sum + value, 0) / scores.length : null,
    passRate: scores.length
      ? (scores.filter((value) => value / fullMark >= 0.6).length / scores.length) * 100
      : null,
    excellentRate: scores.length
      ? (scores.filter((value) => value / fullMark >= 0.8).length / scores.length) * 100
      : null,
    bands: boundaries.map((min, index) => ({
      label: index === 0 ? '90-100%' : `${min}-${boundaries[index - 1]}%（不含上限）`,
      count: scores.filter(
        (value) =>
          (value / fullMark) * 100 >= min &&
          (index === 0 || (value / fullMark) * 100 < boundaries[index - 1]!)
      ).length
    })),
    students
  }
}
/** 同名按出现次数匹配；差集不会把重复姓名简单折叠成一人。 */
export function compareNames(baseline: string[], comparison: string[]) {
  const remaining = new Map<string, number>()
  for (const value of comparison)
    remaining.set(value.trim(), (remaining.get(value.trim()) || 0) + 1)
  const matched: string[] = [],
    baselineOnly: string[] = [],
    comparisonOnly: string[] = []
  for (const value of baseline) {
    const name = value.trim(),
      count = remaining.get(name) || 0
    if (count) {
      matched.push(name)
      remaining.set(name, count - 1)
    } else baselineOnly.push(name)
  }
  for (const [name, count] of remaining)
    for (let index = 0; index < count; index++) comparisonOnly.push(name)
  return { matched, baselineOnly, comparisonOnly }
}
