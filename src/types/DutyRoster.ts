import type { ExcelStudentSourceType, StudentSourceType } from '@/types/StudentSource'

/** 值日表模式：按天 / 按周 */
export enum DutyRosterModeEnum {
  Daily = 'daily',
  Weekly = 'weekly'
}

/** 值日周期枚举（周一至周五 + 整周） */
export enum DutyPeriodEnum {
  Monday = 'monday',
  Tuesday = 'tuesday',
  Wednesday = 'wednesday',
  Thursday = 'thursday',
  Friday = 'friday',
  Weekly = 'weekly'
}

/** 值日岗位类型：室内 / 清洁 */
export type DutySectionKindType = 'indoor' | 'cleaning'

/** 值日具体岗位 */
export interface DutyPositionType {
  id: string
  name: string
  sortOrder: number
}

/** 值日组 / 区域（如"教室""走廊""操场"） */
export interface DutySectionType {
  id: string
  name: string
  kind: DutySectionKindType
  sortOrder: number
  positions: DutyPositionType[]
}

/** 周表行（按周模式下的轮次行） */
export interface DutyWeeklyRowType {
  id: string
  sortOrder: number
}

/** 值日分配记录 */
export interface DutyAssignmentType {
  period: DutyPeriodEnum
  rowId?: string
  positionId: string
  studentIds: string[]
}

/** 值日组长记录 */
export interface DutyLeaderType {
  period: DutyPeriodEnum
  rowId?: string
  sectionId: string
  studentId: string
}

/** 值日表完整配置 */
export interface DutyRosterType {
  id: string
  name: string
  mode: DutyRosterModeEnum
  studentSource: StudentSourceType
  excelSource?: ExcelStudentSourceType
  sections: DutySectionType[]
  weeklyRows: DutyWeeklyRowType[]
  assignments: DutyAssignmentType[]
  leaders: DutyLeaderType[]
  notes: string
  createdAt: string
  updatedAt: string
}

/** 值日表 Store 状态 */
export interface DutyRosterStateType {
  rosters: DutyRosterType[]
  editingRosterId: string | null
  isSidebarCollapsed: boolean
}

/** 值日分配目标（用于右键菜单确定分配位置） */
export interface DutyAssignmentTargetType {
  period: DutyPeriodEnum
  rowId?: string
  positionId: string
}
