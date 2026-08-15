import type { ExcelStudentSourceType, StudentSourceType } from '@/types/StudentSource'

/** 值日表模式：按天 / 按周 */
export enum DutyRosterModeEnum {
  /** 按天排班 */
  Daily = 'daily',
  /** 按周排班 */
  Weekly = 'weekly'
}

/** 值日周期枚举（周一至周五 + 整周） */
export enum DutyPeriodEnum {
  /** 周一 */
  Monday = 'monday',
  /** 周二 */
  Tuesday = 'tuesday',
  /** 周三 */
  Wednesday = 'wednesday',
  /** 周四 */
  Thursday = 'thursday',
  /** 周五 */
  Friday = 'friday',
  /** 整周 */
  Weekly = 'weekly'
}

/** 值日岗位类型：室内 / 清洁 */
export type DutySectionKindType = 'indoor' | 'cleaning'

/** 值日具体岗位 */
export interface DutyPositionType {
  /** 岗位唯一标识 */
  id: string
  /** 岗位名称 */
  name: string
  /** 岗位排序权重（数值越小越靠前） */
  sortOrder: number
}

/** 值日组 / 区域（如"教室""走廊""操场"） */
export interface DutySectionType {
  /** 区域唯一标识 */
  id: string
  /** 区域名称 */
  name: string
  /** 区域类型：室内 / 清洁 */
  kind: DutySectionKindType
  /** 区域排序权重（数值越小越靠前） */
  sortOrder: number
  /** 该区域下的岗位列表 */
  positions: DutyPositionType[]
}

/** 周表行（按周模式下的轮次行） */
export interface DutyWeeklyRowType {
  /** 周表行唯一标识 */
  id: string
  /** 行排序权重（数值越小越靠前） */
  sortOrder: number
}

/** 值日分配记录 */
export interface DutyAssignmentType {
  /** 值日周期 */
  period: DutyPeriodEnum
  /** 周表行 ID（按周模式下使用） */
  rowId?: string
  /** 分配的岗位 ID */
  positionId: string
  /** 分配到该岗位的学生 ID 列表 */
  studentIds: string[]
}

/** 值日组长记录 */
export interface DutyLeaderType {
  /** 值日周期 */
  period: DutyPeriodEnum
  /** 周表行 ID（按周模式下使用） */
  rowId?: string
  /** 负责的区域 ID */
  sectionId: string
  /** 组长学生 ID */
  studentId: string
}

/** 值日表完整配置 */
export interface DutyRosterType {
  /** 值日表唯一标识 */
  id: string
  /** 值日表名称 */
  name: string
  /** 排班模式：按天 / 按周 */
  mode: DutyRosterModeEnum
  /** 学生来源类型 */
  studentSource: StudentSourceType
  /** Excel 学生名单快照（Excel 来源时使用） */
  excelSource?: ExcelStudentSourceType
  /** 值日区域列表 */
  sections: DutySectionType[]
  /** 周表行列表（按周模式使用） */
  weeklyRows: DutyWeeklyRowType[]
  /** 值日分配记录列表 */
  assignments: DutyAssignmentType[]
  /** 值日组长记录列表 */
  leaders: DutyLeaderType[]
  /** 备注 */
  notes: string
  /** 创建时间（ISO 格式） */
  createdAt: string
  /** 更新时间（ISO 格式） */
  updatedAt: string
}

/** 值日表 Store 状态 */
export interface DutyRosterStateType {
  /** 所有值日表 */
  rosters: DutyRosterType[]
  /** 当前编辑中的值日表 ID（null 表示无） */
  editingRosterId: string | null
  /** 侧边栏是否折叠 */
  isSidebarCollapsed: boolean
}

/** 值日分配目标（用于右键菜单确定分配位置） */
export interface DutyAssignmentTargetType {
  /** 值日周期 */
  period: DutyPeriodEnum
  /** 周表行 ID（按周模式下使用） */
  rowId?: string
  /** 岗位 ID */
  positionId: string
}
