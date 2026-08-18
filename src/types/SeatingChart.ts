/** 座位表模块的类型定义 */
import type { ExcelStudentSourceType, StudentSourceType } from '@/types/StudentSource'

/** 座位表第一列朝向：左侧靠墙 / 右侧靠墙 */
export enum SeatingFirstColumnSideEnum {
  /** 左侧靠墙 */
  Left = 'left',
  /** 右侧靠墙 */
  Right = 'right'
}

/** 单个座位位置 */
export interface SeatPositionType {
  /** 行号 */
  row: number
  /** 列号 */
  column: number
  /** 座位上学生的 ID（null 表示空座） */
  studentId: string | null
}

/** 特殊座位位置（讲台左 / 讲台右） */
export enum SeatingSpecialSeatPositionEnum {
  /** 讲台左 */
  PlatformLeft = 'platform-left',
  /** 讲台右 */
  PlatformRight = 'platform-right'
}

/** 特殊座位配置 */
export interface SeatingSpecialSeatType {
  /** 特殊座位位置 */
  position: SeatingSpecialSeatPositionEnum
  /** 是否启用该特殊座位 */
  enabled: boolean
  /** 座位上学生的 ID（null 表示空座） */
  studentId: string | null
}

/** 座位表完整配置 */
export interface SeatingChartType {
  /** 座位表唯一标识 */
  id: string
  /** 座位表名称 */
  name: string
  /** 学生来源类型 */
  studentSource: StudentSourceType
  /** Excel 学生名单快照（Excel 来源时使用） */
  excelSource?: ExcelStudentSourceType
  /** 座位行数 */
  rows: number
  /** 座位列数 */
  columns: number
  /** 需要留出过道的列号列表（0 起始） */
  aisleAfterColumns: number[]
  /** 第一列朝向（左侧/右侧靠墙） */
  firstColumnSide: SeatingFirstColumnSideEnum
  /** 普通座位列表 */
  seats: SeatPositionType[]
  /** 特殊座位配置列表 */
  specialSeats: SeatingSpecialSeatType[]
  /** 创建时间（ISO 格式） */
  createdAt: string
  /** 更新时间（ISO 格式） */
  updatedAt: string
}

/** 座位表 Store 状态 */
export interface SeatingChartStateType {
  /** 所有座位表 */
  charts: SeatingChartType[]
  /** 当前编辑中的座位表 ID（null 表示无） */
  editingChartId: string | null
  /** 侧边栏是否折叠 */
  isSidebarCollapsed: boolean
}

/** 座位表随机排座预览结果 */
export interface SeatingChartPreviewType {
  /** 排座后的座位列表 */
  seats: SeatPositionType[]
  /** 被随机分配的学生 ID 列表 */
  randomizedStudentIds: string[]
  /** 未分配座位的学生数量 */
  unassignedCount: number
  /** 未分配座位的学生 ID 列表 */
  unassignedStudentIds: string[]
}
