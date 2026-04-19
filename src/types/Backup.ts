import type { AIPromptsType, AIModelTypeEnum } from '@/types/AIConfig'
import type { ConfigurationType } from '@/types/Configuration'
import type { SettingType, TagCategoryType, TagType } from '@/types/Setting'
import type { StudentDataType } from '@/types/StudentData'
import type { ThemeName } from '@/config/theme'

export interface BackupData {
  version: number
  setting: { tableHeaders: SettingType[]; tagCategory: TagCategoryType[]; tags: TagType }
  dataSource: { items: StudentDataType[] }
  configuration: ConfigurationType
  aiConfig: {
    modelType: AIModelTypeEnum
    model: string
    apiKey: string
    baseUrl: string
    prompts: AIPromptsType
    availableModels: string[]
  }
  theme: { currentTheme: ThemeName }
}
