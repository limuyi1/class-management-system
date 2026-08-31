/**
 * 值日表核心工具
 * 提供值日分组、岗位、分配、学生剔除等底层操作
 */
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

/** 每日值日的五个工作日周期（不含周末） */
export const DUTY_DAILY_PERIODS = [
  DutyPeriodEnum.Monday,
  DutyPeriodEnum.Tuesday,
  DutyPeriodEnum.Wednesday,
  DutyPeriodEnum.Thursday,
  DutyPeriodEnum.Friday
] as const

/** 值日周期对应的中文标签，周值日无星期标签 */
export const DUTY_PERIOD_LABELS: Record<DutyPeriodEnum, string> = {
  [DutyPeriodEnum.Monday]: '星期一',
  [DutyPeriodEnum.Tuesday]: '星期二',
  [DutyPeriodEnum.Wednesday]: '星期三',
  [DutyPeriodEnum.Thursday]: '星期四',
  [DutyPeriodEnum.Friday]: '星期五',
  [DutyPeriodEnum.Weekly]: ''
}

/** 生成唯一 ID */
const createId = (): string => crypto.randomUUID()

/**
 * 根据值日模式返回周期列表：每日模式为周一至周五，周模式为单个"周"周期。
 * @param mode - 值日模式
 * @returns 周期数组
 */
export const getDutyPeriods = (mode: DutyRosterModeEnum): DutyPeriodEnum[] =>
  mode === DutyRosterModeEnum.Daily ? [...DUTY_DAILY_PERIODS] : [DutyPeriodEnum.Weekly]

/** 创建周值日的一行（分组行） */
export function createDutyWeeklyRow(sortOrder: number): DutyWeeklyRowType {
  return { id: createId(), sortOrder }
}

/** 创建默认的周值日行列表（初始只有一行） */
export function createDefaultDutyWeeklyRows(): DutyWeeklyRowType[] {
  return [createDutyWeeklyRow(0)]
}

/** 创建值日岗位 */
export function createDutyPosition(name: string, sortOrder: number): DutyPositionType {
  return { id: createId(), name, sortOrder }
}

/** 创建默认值日分区（室内岗位与清洁区域） */
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

/** 创建默认值日说明文本 */
export function createDefaultDutyNotes(): string {
  return [
    '红色姓名表示值日组长',
    '1. 组长负责分工并检查卫生完成情况；',
    '2. 摆课桌、窗台和门、走廊、垃圾桶等岗位职责；',
    '3. 清洁区域需与检查时间同步。'
  ].join('\n')
}

/**
 * 根据岗位 ID 查找所属分区。
 * @param roster - 值日表
 * @param positionId - 岗位 ID
 * @returns 包含该岗位的分区，未找到返回 undefined
 */
export function findDutySectionByPosition(
  roster: DutyRosterType,
  positionId: string
): DutySectionType | undefined {
  return roster.sections.find((section) =>
    section.positions.some((position) => position.id === positionId)
  )
}

/**
 * 按周期、岗位和行（周模式）查找值日分配记录。
 * @param assignments - 分配记录列表
 * @param period - 周期
 * @param positionId - 岗位 ID
 * @param rowId - 周模式下的行 ID（每日模式忽略）
 * @returns 匹配的分配记录，未找到返回 undefined
 */
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

/** 收集值日表中所有被分配的学生 ID（可能重复） */
export function getDutyStudentIds(roster: DutyRosterType): string[] {
  return roster.assignments.flatMap((assignment) => assignment.studentIds)
}

/** 统计某岗位已分配的学生数量 */
export function getDutyPositionStudentCount(roster: DutyRosterType, positionId: string): number {
  return roster.assignments
    .filter((assignment) => assignment.positionId === positionId)
    .reduce((count, assignment) => count + assignment.studentIds.length, 0)
}

/**
 * 将值日表数据规范化为当前结构：排序并重编序号、清理无效分配/组长，
 * 并修正旧版"皇冠图标"说明文本。
 * @param roster - 原始值日表
 * @param validStudentIds - 当前有效的学生 ID 集合
 * @returns 规范化后的值日表
 */
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
    return items.findIndex((item) => item.studentId === leader.studentId) === index
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

/**
 * 从值日分配与组长中移除指定学生，并清理因此变为空的分配记录。
 * @param assignments - 分配记录列表
 * @param leaders - 组长列表
 * @param studentId - 待移除的学生 ID
 * @returns 更新后的分配记录与组长列表
 */
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
