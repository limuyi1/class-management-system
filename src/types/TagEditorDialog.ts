import { NAME_PROP } from '@/types/Constants'

export interface TagEditorDialogStudent {
  [NAME_PROP]: string
  tags?: Record<string, string[]>
}

export interface TagEditorDialogProps {
  visible: boolean
  student: TagEditorDialogStudent | null
}

export interface TagEditorDialogEmits {
  'update:visible': [value: boolean]
  confirm: [tags: Record<string, string[]>]
}
