import type { ScoreStateType } from '@/types/ApiScores'
import type { SettingType } from '@/types/Setting'
import type { StudentDataType } from '@/types/StudentData'

/** 将关系表 DTO 转成原有动态 prop 行；仅展示投影可以含历史字段，写入不能使用此对象。 */
export function buildApiScoreProjection(state: ScoreStateType): {
  headers: SettingType[]
  rows: StudentDataType[]
  rankByProp: Map<string, Map<string, number>>
} {
  const byStudent = new Map(
    state.students.map((student) => [
      student.studentId,
      {
        studentId: student.studentId,
        name: student.name,
        disabled: student.disabled,
        departed: student.departed
      } as StudentDataType
    ])
  )
  const headers: SettingType[] = state.assessments
    .filter((column) => !column.disabled)
    .map((column) => ({
      prop: column.prop,
      label: column.label,
      disabled: false,
      fullMark: column.fullMark ?? state.workspace.scoreFullMark
    }))
  const columns = new Map(state.assessments.map((column) => [column.id, column]))
  // 先补空值，零分无需特殊判断，严禁从参照填入本期列。
  for (const row of byStudent.values())
    for (const column of state.assessments) row[column.prop] = null
  for (const score of state.scores) {
    const row = byStudent.get(score.studentId)
    const column = columns.get(score.assessmentId)
    if (row && column) row[column.prop] = score.value
  }
  const rankByProp = new Map<string, Map<string, number>>()
  for (const reference of state.references) {
    headers.push({
      prop: reference.prop,
      label: reference.label,
      disabled: false,
      fullMark: reference.fullMark,
      reference: true
    })
    const ranks = new Map<string, number>()
    for (const row of byStudent.values()) row[reference.prop] = null
    for (const score of reference.scores) {
      const row = byStudent.get(score.studentId)
      if (row) row[reference.prop] = score.value
      if (score.rank !== null) ranks.set(score.studentId, score.rank)
    }
    rankByProp.set(reference.prop, ranks)
  }
  return { headers, rows: [...byStudent.values()], rankByProp }
}
