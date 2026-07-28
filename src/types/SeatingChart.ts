import type { ExcelStudentSourceType, StudentSourceType } from '@/types/StudentSource'

/** 座位表第一列朝向：左侧靠墙 / 右侧靠墙 */
export enum SeatingFirstColumnSideEnum {
  Left = 'left',
  Right = 'right'
}

/** 单个座位位置 */
export interface SeatPositionType {
  row: number
  column: number
  studentId: string | null
}

/** 特殊座位位置（讲台左 / 讲台右） */
export enum SeatingSpecialSeatPositionEnum {
  PlatformLeft = 'platform-left',
  PlatformRight = 'platform-right'
}

/** 特殊座位配置 */
export interface SeatingSpecialSeatType {
  position: SeatingSpecialSeatPositionEnum
  enabled: boolean
  studentId: string | null
}

/** 座位表完整配置 */
export interface SeatingChartType {
  id: string
  name: string
  studentSource: StudentSourceType
  excelSource?: ExcelStudentSourceType
  rows: number
  columns: number
  aisleAfterColumns: number[]
  firstColumnSide: SeatingFirstColumnSideEnum
  seats: SeatPositionType[]
  specialSeats: SeatingSpecialSeatType[]
  createdAt: string
  updatedAt: string
}

/** 座位表 Store 状态 */
export interface SeatingChartStateType {
  charts: SeatingChartType[]
  editingChartId: string | null
  isSidebarCollapsed: boolean
}

/** 座位表随机排座预览结果 */
export interface SeatingChartPreviewType {
  seats: SeatPositionType[]
  randomizedStudentIds: string[]
  unassignedCount: number
  unassignedStudentIds: string[]
}
