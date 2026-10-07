import { readScoreState } from './scoreProjection.js'
import type { AccessContextType, DatabaseType } from '../types/Account.js'
/** 当前统计排除历史参照；趋势独立按学生 ID 连结，缺失不补零。 */
export function readAnalysis(
  database: DatabaseType,
  context: AccessContextType,
  id: string,
  requestId: string
) {
  const state = readScoreState(database, context, id, requestId),
    active = state.students.filter((row) => !row.disabled && !row.departed)
  const units = state.assessments
    .filter((row) => !row.disabled)
    .map((unit) => {
      const values = active.map(
        (student) =>
          state.scores.find(
            (row) => row.studentId === student.studentId && row.assessmentId === unit.id
          )?.value ?? null
      )
      const full = unit.fullMark ?? state.workspace.scoreFullMark
      const buckets = [0, 0, 0, 0, 0]
      for (const value of values)
        if (value !== null)
          buckets[
            value / full >= 0.9
              ? 0
              : value / full >= 0.8
                ? 1
                : value / full >= 0.6
                  ? 2
                  : value / full >= 0.4
                    ? 3
                    : 4
          ]!++
      return {
        ...state.statistics.find((row) => row.assessmentId === unit.id),
        id: unit.id,
        label: unit.label,
        fullMark: full,
        buckets
      }
    })
  const students = active.map((student) => {
    const points = state.assessments
      .filter((row) => !row.disabled)
      .map((unit) => {
        const score =
          state.scores.find(
            (row) => row.studentId === student.studentId && row.assessmentId === unit.id
          )?.value ?? null
        const all = active
          .map(
            (item) =>
              state.scores.find(
                (row) => row.studentId === item.studentId && row.assessmentId === unit.id
              )?.value ?? null
          )
          .filter((value) => value !== null)
        return {
          label: unit.label,
          value: score,
          percent:
            score === null
              ? null
              : (score / (unit.fullMark ?? state.workspace.scoreFullMark)) * 100,
          rank: score === null ? null : 1 + all.filter((value) => value! > score).length
        }
      })
    const present = points.filter((row) => row.percent !== null)
    const history = state.references.map((reference) => {
      const value = reference.scores.find((row) => row.studentId === student.studentId)
      return {
        label: reference.label,
        value: value?.value ?? null,
        percent:
          value?.value === null || value?.value === undefined
            ? null
            : (value.value / reference.fullMark) * 100,
        rank: value?.rank ?? null
      }
    })
    return {
      ...student,
      recorded: present.length,
      missing: points.length - present.length,
      average: present.length
        ? present.reduce((sum, row) => sum + row.percent!, 0) / present.length
        : null,
      points,
      history
    }
  })
  return { workspace: state.workspace, units, students }
}
