import type { StyleValue } from 'vue'

/** 超长文本 Tooltip 组件 Props */
export interface OverlengthTextTooltipProps {
  /** 要显示的文本内容 */
  content: string | number
  /** 文本区域宽度（超出则截断并显示 Tooltip） */
  width?: number
  /** 文本层级（用于调整 z-index） */
  level?: number
  /** 自定义 CSS 类 */
  customClass?: string
  /** 自定义 CSS 样式 */
  customStyle?: StyleValue
}
