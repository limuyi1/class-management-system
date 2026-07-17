import {
  DutyPeriodEnum,
  DutyRosterModeEnum,
  type DutyAssignmentType,
  type DutyLeaderType,
  type DutyPositionType,
  type DutyRosterType,
  type DutySectionType,
  type DutyWeeklyRowType
} from '@/types/DutyRoster'

export const DUTY_DAILY_PERIODS = [
  DutyPeriodEnum.Monday,
  DutyPeriodEnum.Tuesday,
  DutyPeriodEnum.Wednesday,
  DutyPeriodEnum.Thursday,
  DutyPeriodEnum.Friday
] as const

export const DUTY_PERIOD_LABELS: Record<DutyPeriodEnum, string> = {
  [DutyPeriodEnum.Monday]: '星期一',
  [DutyPeriodEnum.Tuesday]: '星期二',
  [DutyPeriodEnum.Wednesday]: '星期三',
  [DutyPeriodEnum.Thursday]: '星期四',
  [DutyPeriodEnum.Friday]: '星期五',
  [DutyPeriodEnum.Weekly]: ''
}

const createId = (): string => crypto.randomUUID()

export const getDutyPeriods = (mode: DutyRosterModeEnum): DutyPeriodEnum[] =>
  mode === DutyRosterModeEnum.Daily ? [...DUTY_DAILY_PERIODS] : [DutyPeriodEnum.Weekly]

export function createDutyWeeklyRow(sortOrder: number): DutyWeeklyRowType {
  return { id: createId(), sortOrder }
}

export function createDefaultDutyWeeklyRows(): DutyWeeklyRowType[] {
  return [createDutyWeeklyRow(0)]
}

export function createDutyPosition(name: string, sortOrder: number): DutyPositionType {
  return { id: createId(), name, sortOrder }
}

export function createDefaultDutySections(): DutySectionType[] {
  return [
    {
      id: createId(),
      name: '室内岗位',
      kind: 'indoor',
      sortOrder: 0,
      positions: [
        createDutyPosition('一组+讲台', 0),
        createDutyPosition('二、三组', 1),
        createDutyPosition('四、五组', 2),
        createDutyPosition('六、七组', 3),
        createDutyPosition('摆课桌', 4),
        createDutyPosition('窗台+门', 5),
        createDutyPosition('走廊', 6),
        createDutyPosition('垃圾桶', 7)
      ]
    },
    {
      id: createId(),
      name: '清洁区域',
      kind: 'cleaning',
      sortOrder: 1,
      positions: [createDutyPosition('清洁区', 0)]
    }
  ]
}

export function createDefaultDutyNotes(): string {
  return [
    '红色圆点及红色姓名表示值日组长',
    '1. 组长负责分工并检查卫生完成情况；',
    '2. 摆课桌、窗台和门、走廊、垃圾桶等岗位职责；',
    '3. 清洁区域需与检查时间同步。'
  ].join('\n')
}

export function findDutySectionByPosition(
  roster: DutyRosterType,
  positionId: string
): DutySectionType | undefined {
  return roster.sections.find((section) =>
    section.positions.some((position) => position.id === positionId)
  )
}

export function getDutyAssignment(
  assignments: DutyAssignmentType[],
  period: DutyPeriodEnum,
  positionId: string,
  rowId?: string
): DutyAssignmentType | undefined {
  return assignments.find(
    (assignment) =>
      assignment.period === period &&
      assignment.positionId === positionId &&
      assignment.rowId === rowId
  )
}

export function getDutyStudentIds(roster: DutyRosterType): string[] {
  return roster.assignments.flatMap((assignment) => assignment.studentIds)
}

export function getDutyPositionStudentCount(roster: DutyRosterType, positionId: string): number {
  return roster.assignments
    .filter((assignment) => assignment.positionId === positionId)
    .reduce((count, assignment) => count + assignment.studentIds.length, 0)
}

export function normalizeDutyRoster(
  roster: DutyRosterType,
  validStudentIds: Set<string>
): DutyRosterType {
  const periods = new Set(getDutyPeriods(roster.mode))
  const existingWeeklyRows = roster.weeklyRows?.length
    ? roster.weeklyRows
    : createDefaultDutyWeeklyRows()
  const weeklyRows = [...existingWeeklyRows]
    .sort((left, right) => left.sortOrder - right.sortOrder)
    .map((row, index) => ({ ...row, sortOrder: index }))
  const weeklyRowIds = new Set(weeklyRows.map((row) => row.id))
  const fallbackWeeklyRowId = weeklyRows[0].id
  const sections = [...roster.sections]
    .sort((left, right) => left.sortOrder - right.sortOrder)
    .map((section, sectionIndex) => ({
      ...section,
      sortOrder: sectionIndex,
      positions: [...section.positions]
        .sort((left, right) => left.sortOrder - right.sortOrder)
        .map((position, positionIndex) => ({ ...position, sortOrder: positionIndex }))
    }))
  const positionIds = new Set(
    sections.flatMap((section) => section.positions.map((position) => position.id))
  )
  const assignedStudentIds = new Set<string>()
  const assignments: DutyAssignmentType[] = roster.assignments.flatMap((assignment) => {
    if (!periods.has(assignment.period) || !positionIds.has(assignment.positionId)) return []
    const rowId =
      roster.mode === DutyRosterModeEnum.Weekly
        ? assignment.rowId && weeklyRowIds.has(assignment.rowId)
          ? assignment.rowId
          : fallbackWeeklyRowId
        : undefined
    const studentIds = assignment.studentIds.filter((studentId) => {
      if (!validStudentIds.has(studentId) || assignedStudentIds.has(studentId)) return false
      assignedStudentIds.add(studentId)
      return true
    })
    if (!studentIds.length) return []
    return roster.mode === DutyRosterModeEnum.Weekly
      ? [{ ...assignment, rowId, studentIds }]
      : [{ period: assignment.period, positionId: assignment.positionId, studentIds }]
  })
  const leaders = roster.leaders.filter((leader, index, items) => {
    if (!periods.has(leader.period) || !validStudentIds.has(leader.studentId)) return false
    const rowId =
      roster.mode === DutyRosterModeEnum.Weekly
        ? leader.rowId && weeklyRowIds.has(leader.rowId)
          ? leader.rowId
          : fallbackWeeklyRowId
        : undefined
    const section = sections.find((item) => item.id === leader.sectionId)
    if (!section) return false
    const studentAssignment = assignments.find(
      (assignment) =>
        assignment.period === leader.period &&
        assignment.rowId === rowId &&
        assignment.studentIds.includes(leader.studentId)
    )
    if (!studentAssignment) return false
    if (!section.positions.some((position) => position.id === studentAssignment.positionId)) {
      return false
    }
    return (
      items.findIndex(
        (item) =>
          item.period === leader.period &&
          (roster.mode !== DutyRosterModeEnum.Weekly ||
            (item.rowId || fallbackWeeklyRowId) === rowId) &&
          item.sectionId === leader.sectionId
      ) === index
    )
  })

  return {
    ...roster,
    sections,
    weeklyRows,
    assignments,
    leaders: leaders.map((leader) =>
      roster.mode === DutyRosterModeEnum.Weekly
        ? {
            ...leader,
            rowId:
              leader.rowId && weeklyRowIds.has(leader.rowId) ? leader.rowId : fallbackWeeklyRowId
          }
        : {
            period: leader.period,
            sectionId: leader.sectionId,
            studentId: leader.studentId
          }
    ),
    notes: (roster.notes || createDefaultDutyNotes())
      .split('皇冠图标及红色姓名')
      .join('红色圆点及红色姓名')
      .split('皇冠图标')
      .join('红色圆点')
  }
}

export function removeDutyStudent(
  assignments: DutyAssignmentType[],
  leaders: DutyLeaderType[],
  studentId: string
): { assignments: DutyAssignmentType[]; leaders: DutyLeaderType[] } {
  return {
    assignments: assignments.flatMap((assignment) => {
      const studentIds = assignment.studentIds.filter((id) => id !== studentId)
      return studentIds.length ? [{ ...assignment, studentIds }] : []
    }),
    leaders: leaders.filter((leader) => leader.studentId !== studentId)
  }
}
