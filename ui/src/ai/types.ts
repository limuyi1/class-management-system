import type { AIPromptsType } from '@/types/AIConfig'
import type { AIModelTypeEnum } from '@/types/AIConfig'

/** AI 服务调用所需的配置 */
export interface AIServiceConfig {
  modelType: AIModelTypeEnum
  model: string
  apiKey: string
  baseUrl: string
  prompts?: AIPromptsType
}
