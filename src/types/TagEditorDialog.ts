export interface TagEditorDialogStudent {
  xing4_ming2: string
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
