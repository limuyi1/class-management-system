import type { AIPromptsType, AIModelTypeEnum } from '@/types/AIConfig'
import type { ConfigurationType } from '@/types/Configuration'
import type { SettingType, TagCategoryType, TagType } from '@/types/Setting'
import type { StudentDataType } from '@/types/StudentData'
import type { ThemeName } from '@/config/theme'

/**
 * 应用备份数据格式
 * 用于导出/导入全量数据，包含设置、成绩、评语、AI 配置、主题等所有持久化状态
 */
export interface BackupData {
  /** 备份格式版本号，用于向前兼容 */
  version: number
  /** 表格设置（列配置、标签分类、标签数据） */
  setting: { scoreColumns: SettingType[]; tagCategories: TagCategoryType[]; tags: TagType }
  /** 学生数据源 */
  dataSource: { students: StudentDataType[] }
  /** 全局配置 */
  configuration: ConfigurationType
  /** AI 配置 */
  aiConfig: {
    modelType: AIModelTypeEnum
    model: string
    apiKey: string
    baseUrl: string
    prompts: AIPromptsType
    availableModels: string[]
  }
  /** 主题设置 */
  theme: { currentTheme: ThemeName }
}
