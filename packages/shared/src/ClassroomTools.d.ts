import type { EnrollmentType, WorkspaceRecordType } from './Workspace.js'

/** 学生数据来源相关的类型定义 */

/** 可在业务页面间复用的学生来源种类。 */
export type StudentSourceType = 'system' | 'excel'

/**
 * 来源无关的最小学生结构。
 * 业务组件依赖该结构后，无需知道学生来自系统 Store 还是 Excel 行。
 */
export interface StudentSourceStudentType {
  /** 学生唯一标识 */
  id: string
  /** 学生姓名 */
  name: string
}

/** 可持久化到具体业务数据中的 Excel 名单快照。 */
export interface ExcelStudentSourceType {
  /** 名单文件名 */
  fileName: string
  /** 学生列表 */
  students: StudentSourceStudentType[]
}

/** 座位表模块的类型定义 */

/** 座位表第一列朝向：左侧靠墙 / 右侧靠墙 */
export type SeatingFirstColumnSideEnum = 'left' | 'right'

/** 座位表讲台位置：画布上方 / 画布下方 */
export type SeatingPlatformPositionEnum = 'top' | 'bottom'

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
export type SeatingSpecialSeatPositionEnum = 'platform-left' | 'platform-right'

/** 特殊座位配置 */
export interface SeatingSpecialSeatType {
  /** 特殊座位位置 */
  position: SeatingSpecialSeatPositionEnum
  /** 是否启用该特殊座位 */
  enabled: boolean
  /** 座位上学生的 ID（null 表示空座） */
  studentId: string | null
}

/** 座位表中的可配置学生职务 */
export interface SeatingRoleDefinitionType {
  /** 职务唯一标识 */
  id: string
  /** 所属科目，如语文、数学 */
  subject: string
  /** 职务名称，如组长、副组长、课代表 */
  title: string
  /** 所属小组，可为空 */
  groupName: string
  /** 座位卡上展示的短标签 */
  shortLabel: string
  /** 标注颜色 */
  color: string
  /** 排序权重 */
  sortOrder: number
}

/** 学生与职务的多对多分配记录 */
export interface SeatingRoleAssignmentType {
  /** 学生 ID */
  studentId: string
  /** 学生拥有的职务 ID 列表 */
  roleIds: string[]
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
  /** 讲台在画布中的展示位置 */
  platformPosition: SeatingPlatformPositionEnum
  /** 普通座位列表 */
  seats: SeatPositionType[]
  /** 轮换时固定的学生，跟随当前方案保存 */
  rotationFixedStudentIds?: string[]
  /** 特殊座位配置列表 */
  specialSeats: SeatingSpecialSeatType[]
  /** 可用职务定义 */
  roleDefinitions: SeatingRoleDefinitionType[]
  /** 学生职务分配 */
  roleAssignments: SeatingRoleAssignmentType[]
  /** 座位表备注说明 */
  notes: string
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

/** 值日表模块的类型定义 */

/** 值日表模式：按天 / 按周 */
export type DutyRosterModeEnum = 'daily' | 'weekly'

/** 值日周期枚举（周一至周五 + 整周） */
export type DutyPeriodEnum = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'weekly'

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
  /** 顶部区域标题展示的大组长学生 ID，与每日值日组长相互独立 */
  leaderStudentId?: string
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
  /** 自动分配时每个时段/岗位格的容量 */
  autoAssignCapacities?: Record<string, number>
  /** 按时段和区域设置的值日组长记录 */
  leaders: DutyLeaderType[]
  /** 复制后覆盖的学生卡片总数；缺省时根据现有安排自动推导 */
  studentCardCounts?: Record<string, number>
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

/** 每个方案独立版本；删除保留内容与审计，普通列表不返回已删除方案。 */
export type ClassroomToolKindType = 'seating' | 'duty'
export type ClassroomToolContentType = SeatingChartType | DutyRosterType
export interface ClassroomToolRecordType {
  id: string
  kind: ClassroomToolKindType
  version: number
  content: ClassroomToolContentType
}
export interface ClassroomToolStateType {
  workspace: WorkspaceRecordType
  students: EnrollmentType[]
  tools: ClassroomToolRecordType[]
}
