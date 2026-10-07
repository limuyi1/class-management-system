import { DutyRosterModeEnum } from '@/types/DutyRoster'
import { DUTY_PERIOD_LABELS, getDutyPeriods, getDutyStudentCardCount } from './dutyRosterUtil'

import type { DutyAssignmentType, DutyRosterType } from '@/types/DutyRoster'

/** 自动分配的独立岗位格；key 同时包含时段、周行与岗位身份。 */
export interface DutyAutoSlotType extends DutyAssignmentType {
  key: string
  label: string
}

/** 枚举当前值日表的全部岗位格，区分按天与按周的行。 */
export function getDutyAutoSlots(roster: DutyRosterType): DutyAutoSlotType[] {
  return getDutyPeriods(roster.mode).flatMap((period) => {
    const rows = roster.mode === DutyRosterModeEnum.Weekly ? roster.weeklyRows : [undefined]
    return rows.flatMap((row, index) =>
      roster.sections.flatMap((section) =>
        section.positions.map((position) => ({
          period,
          rowId: row?.id,
          positionId: position.id,
          studentIds: [],
          key: `${period}:${row?.id || ''}:${position.id}`,
          label: `${row ? `第 ${index + 1} 组` : DUTY_PERIOD_LABELS[period]} / ${section.name} / ${position.name}`
        }))
      )
    )
  })
}

/** 按岗位容量分配现有学生卡片，既有安排可保留；不擅自增加任务。 */
export function autoAssignDuty(
  roster: DutyRosterType,
  studentIds: string[],
  capacities: Record<string, number>,
  preserve: boolean,
  random: () => number = Math.random
): { assignments: DutyAssignmentType[]; unassigned: string[]; vacancies: number } {
  const slots = getDutyAutoSlots(roster)
  const remaining = new Map(
    [...new Set(studentIds)].map((id) => [id, getDutyStudentCardCount(roster, id)])
  )
  const assignments = slots.map((slot) => {
    const existing = preserve
      ? roster.assignments.find(
          (item) =>
            item.period === slot.period &&
            item.rowId === slot.rowId &&
            item.positionId === slot.positionId
        )
      : undefined
    const ids = [...new Set(existing?.studentIds || [])].filter((id) => remaining.has(id))
    ids.forEach((id) => remaining.set(id, Math.max(0, (remaining.get(id) || 0) - 1)))
    return { period: slot.period, rowId: slot.rowId, positionId: slot.positionId, studentIds: ids }
  })
  const candidates = [...remaining.keys()]
  for (let index = candidates.length - 1; index > 0; index--) {
    const other = Math.max(0, Math.min(index, Math.floor(random() * (index + 1))))
    ;[candidates[index], candidates[other]] = [candidates[other], candidates[index]]
  }
  let cursor = 0
  assignments.forEach((assignment, index) => {
    const capacity = Math.max(0, Math.floor(capacities[slots[index].key] || 0))
    while (assignment.studentIds.length < capacity) {
      let next: string | undefined
      for (let offset = 0; offset < candidates.length; offset++) {
        const candidateIndex = (cursor + offset) % candidates.length
        const id = candidates[candidateIndex]
        if ((remaining.get(id) || 0) > 0 && !assignment.studentIds.includes(id)) {
          next = id
          cursor = candidateIndex + 1
          break
        }
      }
      if (!next) break
      assignment.studentIds.push(next)
      remaining.set(next, (remaining.get(next) || 0) - 1)
    }
  })
  return {
    assignments: assignments.filter((item) => item.studentIds.length),
    unassigned: [...remaining].flatMap(([id, count]) => Array.from({ length: count }, () => id)),
    vacancies: assignments.reduce(
      (sum, item, index) =>
        sum + Math.max(0, (capacities[slots[index].key] || 0) - item.studentIds.length),
      0
    )
  }
}
