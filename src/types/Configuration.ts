import { PagesEnum } from '@/types/Common'

export interface ConfigurationType {
  fontSize: number
  salutationFontSize: number
  textFontSize: number
  sealFontSize: number
  classTeacherFontSize: number
  inscribeFontSize: number
  inscribe: string
  pageType: PagesEnum
  pageTypeList: Array<PagesEnum>
  inputScoreTab: string | null
}
