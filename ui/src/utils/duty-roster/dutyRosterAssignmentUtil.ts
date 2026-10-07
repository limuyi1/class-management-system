/** 值日分配规则：卡片移动、回收与组长归属，只修改传入的值日表。 */
import { type DutyAssignmentTargetType, type DutyRosterType } from '@/types/DutyRoster'
import {
  findDutySectionByPosition,
  getDutyAssignment,
  getDutyPendingStudentCount
} from '@/utils/duty-roster/dutyRosterUtil'

/**
 * 将右侧的一张待选卡片安排到指定岗位。
 * @param studentId - 学生 ID
 * @param target - 分配目标（时段/岗位/周行）
 */
export function assignDutyStudent(
  roster: DutyRosterType | null,
  studentId: string,
  target: DutyAssignmentTargetType
): void {
  const targetSection = roster ? findDutySectionByPosition(roster, target.positionId) : undefined
  if (!roster || !targetSection) return
  if (getDutyPendingStudentCount(roster, studentId) <= 0) return
  const assignment = getDutyAssignment(
    roster.assignments,
    target.period,
    target.positionId,
    target.rowId
  )
  if (assignment?.studentIds.includes(studentId)) return
  if (assignment) assignment.studentIds.push(studentId)
  else roster.assignments.push({ ...target, studentIds: [studentId] })
  roster.updatedAt = new Date().toISOString()
}

/**
 * 移动表格中的一张学生卡片，不改变该学生的卡片总数。
 * @param studentId - 学生 ID
 * @param source - 原岗位
 * @param target - 目标岗位
 */
export function moveDutyStudent(
  roster: DutyRosterType | null,
  studentId: string,
  source: DutyAssignmentTargetType,
  target: DutyAssignmentTargetType
): void {
  if (!roster || !findDutySectionByPosition(roster, target.positionId)) return
  const sourceAssignment = getDutyAssignment(
    roster.assignments,
    source.period,
    source.positionId,
    source.rowId
  )
  const targetAssignment = getDutyAssignment(
    roster.assignments,
    target.period,
    target.positionId,
    target.rowId
  )
  if (!sourceAssignment?.studentIds.includes(studentId)) return
  if (targetAssignment?.studentIds.includes(studentId)) return

  const sourceSection = findDutySectionByPosition(roster, source.positionId)
  const targetSection = findDutySectionByPosition(roster, target.positionId)
  const leader = roster.leaders.find(
    (item) =>
      item.studentId === studentId &&
      item.period === source.period &&
      item.rowId === source.rowId &&
      item.sectionId === sourceSection?.id
  )

  sourceAssignment.studentIds = sourceAssignment.studentIds.filter((id) => id !== studentId)
  if (!sourceAssignment.studentIds.length) {
    roster.assignments = roster.assignments.filter((item) => item !== sourceAssignment)
  }
  if (targetAssignment) targetAssignment.studentIds.push(studentId)
  else roster.assignments.push({ ...target, studentIds: [studentId] })
  if (leader && targetSection) {
    leader.period = target.period
    leader.rowId = target.rowId
    leader.sectionId = targetSection.id
  }
  roster.updatedAt = new Date().toISOString()
}

/**
 * 将当前位置的一张学生卡片移回右侧待选区。
 * @param studentId - 学生 ID
 * @param target - 当前岗位
 */
export function removeDutyStudentAssignment(
  roster: DutyRosterType | null,
  studentId: string,
  target: DutyAssignmentTargetType
): void {
  if (!roster) return
  const assignment = getDutyAssignment(
    roster.assignments,
    target.period,
    target.positionId,
    target.rowId
  )
  if (!assignment?.studentIds.includes(studentId)) return
  assignment.studentIds = assignment.studentIds.filter((id) => id !== studentId)
  if (!assignment.studentIds.length) {
    roster.assignments = roster.assignments.filter((item) => item !== assignment)
  }
  const section = findDutySectionByPosition(roster, target.positionId)
  // 该学生移回待选区后，若在同时段/周行的其他岗位仍被分配，则保留其组长身份
  // 过滤对象为原组长记录：同一学生、同一时段/周行、同一区域，且原岗位属于该区域
  const remainsInLeaderGroup = roster.assignments.some(
    (item) =>
      item.period === target.period &&
      item.rowId === target.rowId &&
      item.studentIds.includes(studentId) &&
      section?.positions.some((position) => position.id === item.positionId)
  )
  // 删除学生已不在该区域任何岗位的组长记录，避免残留无效组长
  roster.leaders = roster.leaders.filter(
    (leader) =>
      remainsInLeaderGroup ||
      leader.studentId !== studentId ||
      leader.period !== target.period ||
      leader.rowId !== target.rowId ||
      leader.sectionId !== section?.id
  )
  roster.updatedAt = new Date().toISOString()
}

/**
 * 设置或取消当前岗位学生的组长身份。
 * @param studentId - 学生 ID
 * @param target - 当前岗位
 */
export function toggleDutyLeader(
  roster: DutyRosterType | null,
  studentId: string,
  target: DutyAssignmentTargetType
): void {
  const assignment = roster
    ? getDutyAssignment(roster.assignments, target.period, target.positionId, target.rowId)
    : undefined
  const section = roster ? findDutySectionByPosition(roster, target.positionId) : undefined
  if (!roster || !assignment?.studentIds.includes(studentId) || !section) return
  const existingIndex = roster.leaders.findIndex(
    (leader) =>
      leader.studentId === studentId &&
      leader.period === target.period &&
      leader.rowId === target.rowId &&
      leader.sectionId === section.id
  )
  if (existingIndex >= 0) roster.leaders.splice(existingIndex, 1)
  else {
    roster.leaders.push({
      period: target.period,
      rowId: target.rowId,
      sectionId: section.id,
      studentId
    })
  }
  roster.updatedAt = new Date().toISOString()
}
