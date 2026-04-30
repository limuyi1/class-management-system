import type { StudentDataType } from './StudentData'
import type { WrongFolder, WrongQuestion } from './WrongBook'
import type { SettingType, TagCategoryType, TagType } from './Setting'
import type {
  AttachmentRecordType,
  PaperLayoutDraftRecordType,
  PaperLayoutSettingsType
} from './Tools'

export interface DataSourceRecord {
  id: string
  data: StudentDataType[]
}

export interface WrongBookRecord {
  id: string
  folders: WrongFolder[]
  questions: WrongQuestion[]
  selectedFolderId: string
  questionTypes: Array<{ value: string; label: string }>
}

export interface SettingRecord {
  id: string
  tableHeaders: SettingType[]
  tagCategory: TagCategoryType[]
  tags: TagType
}

export interface ConfigurationRecord {
  id: string
  fontSize: number
  salutationFontSize: number
  textFontSize: number
  sealFontSize: number
  classTeacherFontSize: number
  inscribeFontSize: number
  inscribe: string
  pageType: string
  pageTypeList: string[]
  inputScoreTab: string | null
  recentScoreEntries: Record<
    string,
    Array<{ index: number; name: string; score: number; time: string }>
  >
}

export interface ThemeRecord {
  id: string
  currentTheme: string
}

export interface AIConfigRecord {
  id: string
  modelType: string
  model: string
  apiKey: string
  baseUrl: string
  prompts: Record<string, string>
  availableModels: string[]
}

export interface OverviewAnalysisRecord {
  id: string
  analysisText: string
  generatedAt: string
}

export interface ToolsRecord {
  id: string
  paperLayout: PaperLayoutSettingsType
}

export type AttachmentRecord = AttachmentRecordType

export type PaperLayoutDraftRecord = PaperLayoutDraftRecordType
