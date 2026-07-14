import type { ExcelStudentSourceType, StudentSourceType } from '@/types/StudentSource'

export enum SeatingViewDirectionEnum {
  FacingPlatform = 'facing-platform',
  FacingStudents = 'facing-students'
}

export interface SeatPositionType {
  row: number
  column: number
  studentId: string | null
}

export enum SeatingSpecialSeatPositionEnum {
  PlatformLeft = 'platform-left',
  PlatformRight = 'platform-right'
}

export interface SeatingSpecialSeatType {
  position: SeatingSpecialSeatPositionEnum
  enabled: boolean
  studentId: string | null
}

export interface SeatingChartType {
  id: string
  name: string
  studentSource: StudentSourceType
  excelSource?: ExcelStudentSourceType
  rows: number
  columns: number
  aisleAfterColumns: number[]
  viewDirection: SeatingViewDirectionEnum
  seats: SeatPositionType[]
  specialSeats: SeatingSpecialSeatType[]
  createdAt: string
  updatedAt: string
}

export interface SeatingChartStateType {
  charts: SeatingChartType[]
  editingChartId: string | null
  isSidebarCollapsed: boolean
}

export interface SeatingChartPreviewType {
  seats: SeatPositionType[]
  randomizedStudentIds: string[]
  unassignedCount: number
  unassignedStudentIds: string[]
}
