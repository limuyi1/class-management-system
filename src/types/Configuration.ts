import { PagesEnum } from '@/types/Common'

export type PreviewModeType = 'fit' | '50' | '75' | '100' | '125'
export type EvaluationTableAlignType = 'left' | 'center' | 'right'

export interface RecentScoreEntryType {
  index: number
  name: string
  score: number
  time: string
}

export interface ConfigurationType {
  fontSize: number
  salutationFontSize: number
  textFontSize: number
  sealFontSize: number
  classTeacherFontSize: number
  inscribeFontSize: number
  inscribe: string
  showEvaluationPageNumber: boolean
  pageType: PagesEnum
  pageTypeList: Array<PagesEnum>
  evaluationCardWidth: number
  evaluationCardHeight: number
  marginX: number
  marginY: number
  evaluationTableAlign: EvaluationTableAlignType
  previewMode: PreviewModeType
  inputScoreTab: string | null
  recentScoreEntries: Record<string, RecentScoreEntryType[]>
  scoreImageCompressRatio: number | null
}
