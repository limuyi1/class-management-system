import { getDutyAutoSlots } from '@/utils/duty-roster/dutyAutoAssignUtil'
import {
  getDutyStudentAssignmentCount,
  getDutyStudentCardCount
} from '@/utils/duty-roster/dutyRosterUtil'
import type { SeatingChartType } from '@/types/SeatingChart'
import type { DutyRosterType } from '@/types/DutyRoster'

/** 拖到占用座位时交换两人；来自待选区时将原学生放回待选区。 */
export function moveClassroomSeat(
  chart: SeatingChartType,
  studentId: string,
  target: { studentId: string | null }
): void {
  const source = [...chart.seats, ...chart.specialSeats].find(
    (seat) => seat.studentId === studentId
  )
  if (source === target) return
  if (source) source.studentId = target.studentId
  target.studentId = studentId
}
/** 修改分配前固定已推导的卡片数量，移回待选区时保留复制卡片。 */
export function captureDutyCardCounts(roster: DutyRosterType): void {
  const ids = new Set(roster.assignments.flatMap((row) => row.studentIds))
  roster.studentCardCounts = {
    ...roster.studentCardCounts,
    ...Object.fromEntries([...ids].map((id) => [id, getDutyStudentCardCount(roster, id)]))
  }
}
/** 岗位/周表组删除或模式切换后清理容量与不再有分配的组长，保留卡片总数。 */
export function reconcileDutyStructure(roster: DutyRosterType): void {
  const slots = new Set(getDutyAutoSlots(roster).map((slot) => slot.key))
  roster.autoAssignCapacities = Object.fromEntries(
    Object.entries(roster.autoAssignCapacities || {}).filter(([key]) => slots.has(key))
  )
  const leaders = new Set<string>()
  roster.leaders = roster.leaders.filter((leader) => {
    const key = `${leader.period}:${leader.rowId || ''}:${leader.sectionId}:${leader.studentId}`
    if (leaders.has(key)) return false
    leaders.add(key)
    const section = roster.sections.find((row) => row.id === leader.sectionId)
    return roster.assignments.some(
      (row) =>
        row.period === leader.period &&
        row.rowId === leader.rowId &&
        row.studentIds.includes(leader.studentId) &&
        section?.positions.some((position) => position.id === row.positionId)
    )
  })
}
/** 卡片数不能少于已安排次数；上限与服务端一致，禁止隐式删除既有安排。 */
export function setDutyCardCount(roster: DutyRosterType, studentId: string, count: number): void {
  const assigned = getDutyStudentAssignmentCount(roster, studentId)
  if (!Number.isInteger(count) || count < Math.max(1, assigned) || count > 100)
    throw new Error('卡片数必须为 1～100 且不能少于已安排次数')
  const counts = { ...roster.studentCardCounts, [studentId]: count }
  if (Object.values(counts).reduce((sum, value) => sum + value, 0) > 5000)
    throw new Error('学生卡片总数不能超过 5000')
  roster.studentCardCounts = counts
}
/** 周表组身份不随排序改变；只移除指定组的安排和组长。 */
export function removeDutyWeeklyRow(roster: DutyRosterType, rowId: string): void {
  captureDutyCardCounts(roster)
  roster.weeklyRows = roster.weeklyRows.filter((row) => row.id !== rowId)
  roster.assignments = roster.assignments.filter((row) => row.rowId !== rowId)
  roster.leaders = roster.leaders.filter((row) => row.rowId !== rowId)
  roster.weeklyRows.forEach((row, index) => {
    row.sortOrder = index
  })
  reconcileDutyStructure(roster)
}
