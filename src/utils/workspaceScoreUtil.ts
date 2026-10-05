import { getValidScore } from '@/utils/scoreValueUtil'

import type { SettingType } from '@/types/Setting'
import type { StudentDataType } from '@/types/StudentData'
import type { WorkspaceCatalogType, WorkspaceSnapshotType } from '@/types/Workspace'

export interface WorkspaceScoreProjectionType {
  referenceHeaders: SettingType[]
  rawStudents: StudentDataType[]
  normalizedStudents: StudentDataType[]
  normalizedHeaders: SettingType[]
  rankByProp: Map<string, Map<string, number>>
  referenceScores: Map<string, number[]>
  missingReferences: number
}

/** 满分换算只表达得分率，不代表消除了不同测评的难度差异。 */
export function normalizeWorkspaceScore(value: unknown, fullMark: number): number | null {
  const score = getValidScore(value)
  if (score === null || !Number.isFinite(fullMark) || fullMark <= 0) return null
  return Number(((score / fullMark) * 100).toFixed(2))
}

/** 按原班当次有效成绩计算排名，不能用当前名单重算历史排名。 */
function buildRanks(students: StudentDataType[], prop: string): Map<string, number> {
  const scores = students
    .map((student) => getValidScore(student[prop]))
    .filter((score): score is number => score !== null)
    .sort((a, b) => b - a)
  const result = new Map<string, number>()
  students.forEach((student) => {
    const score = getValidScore(student[prop])
    if (score !== null) result.set(student.studentId, scores.indexOf(score) + 1)
  })
  return result
}

/** 原始只读表格与百分制分析共享来源；通过 ID 连接历史，缺失成绩保持空值。 */
export function buildWorkspaceScoreProjection(
  catalog: WorkspaceCatalogType | null,
  snapshots: WorkspaceSnapshotType[],
  students: StudentDataType[],
  headers: SettingType[],
  fullMark: number
): WorkspaceScoreProjectionType {
  const referenceHeaders: SettingType[] = []
  const rawStudents = students.map((student) => ({ ...student }))
  const normalizedStudents = students.map((student) => {
    const row = { ...student }
    headers.forEach((header) => {
      row[header.prop] = normalizeWorkspaceScore(student[header.prop], header.fullMark ?? fullMark)
    })
    return row
  })
  const rankByProp = new Map<string, Map<string, number>>()
  const referenceScores = new Map<string, number[]>()
  let missingReferences = 0
  const active = catalog?.periods.find((period) => period.id === catalog.activePeriodId)
  const references = [...(active?.references ?? [])].sort((a, b) => {
    const periodDiff =
      (catalog?.periods.findIndex((period) => period.id === a.periodId) ?? 0) -
      (catalog?.periods.findIndex((period) => period.id === b.periodId) ?? 0)
    if (periodDiff) return periodDiff
    const source = snapshots.find((item) => item.id === a.periodId)
    const columns = source?.setting?.scoreColumns ?? []
    return (
      columns.findIndex((column) => column.prop === a.prop) -
      columns.findIndex((column) => column.prop === b.prop)
    )
  })
  references.forEach((reference) => {
    const period = catalog?.periods.find((item) => item.id === reference.periodId)
    const snapshot = snapshots.find((item) => item.id === reference.periodId)
    const column = snapshot?.setting?.scoreColumns.find((item) => item.prop === reference.prop)
    if (!period || !snapshot || !column) {
      missingReferences += 1
      return
    }
    const prop = `__history_${reference.periodId}_${reference.prop}`
    const mark = column.fullMark ?? snapshot.preferences.scoreFullMark
    referenceHeaders.push({
      ...column,
      prop,
      label: `${period.className} · ${period.termName} · ${column.label}〔参照〕`,
      disabled: false,
      reference: true,
      fullMark: mark
    })
    const sourceStudents = snapshot.students.filter((student) => !student.disabled)
    rankByProp.set(prop, buildRanks(sourceStudents, reference.prop))
    referenceScores.set(
      prop,
      sourceStudents
        .map((student) => normalizeWorkspaceScore(student[reference.prop], mark))
        .filter((score): score is number => score !== null)
    )
    const byId = new Map(snapshot.students.map((student) => [student.studentId, student]))
    rawStudents.forEach((student, index) => {
      const score = getValidScore(byId.get(student.studentId)?.[reference.prop])
      student[prop] = score
      normalizedStudents[index][prop] = normalizeWorkspaceScore(score, mark)
    })
  })
  return {
    referenceHeaders,
    rawStudents,
    normalizedStudents,
    normalizedHeaders: [...referenceHeaders, ...headers],
    rankByProp,
    referenceScores,
    missingReferences
  }
}
