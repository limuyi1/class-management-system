/** Markdown 编辑器组件 Props */
export interface MarkdownEditorProps {
  /** 编辑器绑定的 Markdown 文本（v-model） */
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
  /** 是否显示分屏模式切换 */
  showSplitMode?: boolean
  /** 是否禁用编辑 */
  disabled?: boolean
}

/** Markdown 编辑器组件 Emits */
export interface MarkdownEditorEmits {
  /** 编辑器内容变化（v-model 更新） */
  (e: 'update:modelValue', value: string): void
  /** 点击插入图片 */
  (e: 'insertImage'): void
  /** 插入公式 */
  (e: 'insertFormula', formula: string): void
  /** 点击预览 */
  (e: 'preview'): void
  /** 点击全屏展开 */
  (e: 'expand'): void
}
