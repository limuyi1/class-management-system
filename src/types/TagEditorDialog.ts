import type { StudentDataType } from '@/types/StudentData'

/** 标签编辑弹窗中的学生类型（与 StudentDataType 一致） */
export type TagEditorDialogStudent = StudentDataType

/** 标签编辑弹窗组件 Props */
export interface TagEditorDialogProps {
  /** 弹窗是否可见 */
  visible: boolean
  /** 待编辑标签的学生（null 表示无选中学生） */
  student: TagEditorDialogStudent | null
}

/** 标签编辑弹窗组件 Emits */
export interface TagEditorDialogEmits {
  /** 弹窗可见性变化 */
  'update:visible': [value: boolean]
  /** 确认标签变更 */
  confirm: [tags: Record<string, string[]>]
  /** 跳转到标签维护 Tab */
  goTab: [tab: string]
}
