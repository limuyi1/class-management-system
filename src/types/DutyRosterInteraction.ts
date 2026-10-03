import type { DutyAssignmentTargetType } from '@/types/DutyRoster'

/** 右键菜单坐标 */
export interface MenuPositionType {
  x: number
  y: number
}

/** 岗位右键菜单状态 */
export interface PositionMenuType extends MenuPositionType {
  positionId: string
}

/** 学生右键菜单状态 */
export interface StudentMenuType extends MenuPositionType {
  studentId: string
  location: 'pending' | 'assigned'
  target?: DutyAssignmentTargetType
}

/** 当前拖拽的学生卡片及其来源岗位；无来源岗位表示来自右侧待选区 */
export interface DraggedStudentType {
  studentId: string
  source?: DutyAssignmentTargetType
}
