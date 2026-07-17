import type { ExcelStudentSourceType, StudentSourceType } from '@/types/StudentSource'

export enum DutyRosterModeEnum {
  Daily = 'daily',
  Weekly = 'weekly'
}

export enum DutyPeriodEnum {
  Monday = 'monday',
  Tuesday = 'tuesday',
  Wednesday = 'wednesday',
  Thursday = 'thursday',
  Friday = 'friday',
  Weekly = 'weekly'
}

export type DutySectionKindType = 'indoor' | 'cleaning'

export interface DutyPositionType {
  id: string
  name: string
  sortOrder: number
}

export interface DutySectionType {
  id: string
  name: string
  kind: DutySectionKindType
  sortOrder: number
  positions: DutyPositionType[]
}

export interface DutyWeeklyRowType {
  id: string
  sortOrder: number
}

export interface DutyAssignmentType {
  period: DutyPeriodEnum
  rowId?: string
  positionId: string
  studentIds: string[]
}

export interface DutyLeaderType {
  period: DutyPeriodEnum
  rowId?: string
  sectionId: string
  studentId: string
}

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

export interface DutyRosterStateType {
  rosters: DutyRosterType[]
  editingRosterId: string | null
  isSidebarCollapsed: boolean
}

export interface DutyAssignmentTargetType {
  period: DutyPeriodEnum
  rowId?: string
  positionId: string
}
