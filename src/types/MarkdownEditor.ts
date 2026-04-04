export interface MarkdownEditorProps {
  modelValue?: string
  placeholder?: string
  minHeight?: string
  showImageBtn?: boolean
  showFormulaBtn?: boolean
  showPreview?: boolean
  showExpand?: boolean
  showSplitMode?: boolean
  disabled?: boolean
}

export interface MarkdownEditorEmits {
  (e: 'update:modelValue', value: string): void
  (e: 'insertImage'): void
  (e: 'insertFormula', formula: string): void
  (e: 'preview'): void
  (e: 'expand'): void
}
