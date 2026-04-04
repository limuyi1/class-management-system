import type { StudentDataType } from './StudentData'
import type { WrongFolder, WrongQuestion } from './WrongBook'
import type { SettingType, TagCategoryType, TagType } from './Setting'
import type { ConfigurationType } from './Configuration'

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
  data: ConfigurationType
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
