import type { StudentDataType } from '@/types/StudentData'

export type TagEditorDialogStudent = StudentDataType

export interface TagEditorDialogProps {
  visible: boolean
  student: TagEditorDialogStudent | null
}

export interface TagEditorDialogEmits {
  'update:visible': [value: boolean]
  confirm: [tags: Record<string, string[]>]
  goTab: [tab: string]
}
