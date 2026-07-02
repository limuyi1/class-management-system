import type { StudentDataType } from './StudentData'
import type { WrongFolder, WrongQuestion } from './WrongBook'
import type { SettingType, TagCategoryType, TagType } from './Setting'
import type { EvaluationHandwriteFontType } from './Configuration'
import type {
  AttachmentRecordType,
  PaperLayoutDraftRecordType,
  PaperLayoutSettingsType
} from './Tools'

export interface StudentDatasetRecord {
  id: string
  students: StudentDataType[]
  updatedAt: string
}

export interface WrongBookRecord {
  id: string
  folders: WrongFolder[]
  questions: WrongQuestion[]
  selectedFolderId: string
  questionTypes: Array<{ value: string; label: string }>
}

export interface WrongBookStorageRecord extends WrongBookRecord {
  updatedAt: string
}

export interface ScoreSettingsRecord {
  id: string
  scoreColumns: SettingType[]
  tagCategories: TagCategoryType[]
  tags: TagType
  updatedAt: string
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
  scoreImageCompressRatio?: number | null
  evaluationHandwriteFont?: EvaluationHandwriteFontType | null
}

export interface AppPreferencesRecord extends ConfigurationRecord {
  updatedAt: string
}

export interface ThemeRecord {
  id: string
  currentTheme: string
}

export interface ThemePreferencesRecord extends ThemeRecord {
  updatedAt: string
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

export interface AISettingsRecord extends AIConfigRecord {
  updatedAt: string
}

export interface OverviewAnalysisRecord {
  id: string
  analysisText: string
  generatedAt: string
}

export interface OverviewAnalysisCacheRecord extends OverviewAnalysisRecord {
  updatedAt: string
}

export interface ToolsRecord {
  id: string
  paperLayout: PaperLayoutSettingsType
}

export interface ToolPreferencesRecord extends ToolsRecord {
  updatedAt: string
}

export type AttachmentRecord = AttachmentRecordType

export type PaperLayoutDraftRecord = PaperLayoutDraftRecordType
