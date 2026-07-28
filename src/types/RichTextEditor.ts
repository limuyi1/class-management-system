/** 富文本编辑器组件 Props */
export interface RichTextEditorProps {
  /** 编辑器绑定的 HTML 文本（v-model） */
  modelValue?: string
  /** 占位提示文本 */
  placeholder?: string
  /** 编辑器最小高度 */
  minHeight?: string
  /** 是否显示插入图片按钮 */
  showImageBtn?: boolean
  /** 是否显示插入公式按钮 */
  showFormulaBtn?: boolean
  /** 是否显示预览按钮 */
  showPreview?: boolean
  /** 是否显示全屏展开按钮 */
  showExpand?: boolean
  /** 是否禁用编辑 */
  disabled?: boolean
}

/** 富文本编辑器组件 Emits */
export interface RichTextEditorEmits {
  (e: 'update:modelValue', value: string): void
  (e: 'insertImage'): void
  (e: 'insertFormula', formula: string): void
  (e: 'preview'): void
  (e: 'expand'): void
}
