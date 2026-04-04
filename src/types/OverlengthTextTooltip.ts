import type { StyleValue } from 'vue'

export interface OverlengthTextTooltipProps {
  content: string | number
  width?: number
  level?: number
  customClass?: string
  customStyle?: StyleValue
}
