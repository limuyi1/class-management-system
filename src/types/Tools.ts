import { PagesEnum } from '@/types/Common'

export type PaperLayoutOrientationType = 'portrait' | 'landscape'

export interface PaperLayoutSettingsType {
  pageType: PagesEnum
  orientation: PaperLayoutOrientationType
  columns: number
  margin: number
  gap: number
}

export interface ToolsStateType {
  paperLayout: PaperLayoutSettingsType
}
