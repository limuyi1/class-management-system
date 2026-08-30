/** 批量标签抽屉组件的 Props 与 Emits 类型定义 */
import { NAME_PROP } from '@/constants'
import type { StudentDataType } from '@/types/StudentData'

/** 批量标签抽屉中的学生类型（确保 name 字段可读） */
export interface StudentData extends StudentDataType {
  /** 学生姓名（可为 null） */
  [NAME_PROP]: string | null
}

/** 批量标签抽屉组件 Props */
export interface BatchTagDrawerProps {
  /** 抽屉是否可见 */
  visible: boolean
  /** 待批量编辑标签的学生列表 */
  studentList: StudentData[]
}

/** 批量标签抽屉组件 Emits */
export interface BatchTagDrawerEmits {
  /** 抽屉可见性变化 */
  'update:visible': [value: boolean]
  /** 保存标签变更 */
  save: [updatedStudents: StudentData[]]
  /** 确认并关闭 */
  confirm: [updatedStudents: StudentData[]]
  /** 跳转到指定 Tab */
  goTab: [tab: string]
}
