import type { AIPromptsType } from '@/types/AIConfig'
import type { AIModelTypeEnum } from '@/types/AIConfig'

export interface AIServiceConfig {
  modelType: AIModelTypeEnum
  model: string
  apiKey: string
  baseUrl: string
  prompts?: AIPromptsType
}
