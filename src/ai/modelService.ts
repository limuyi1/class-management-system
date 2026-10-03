/** AI 连接检测与可用模型查询。 */
import { AIModelTypeEnum } from '@/types/AIConfig'
import { createGeminiModel, openaiGet, withAIRequestTimeout } from '@/ai/providers'

import type { AIServiceConfig } from '@/ai/types'

/**
 * 测试 AI 连接是否可用
 * @param config - AI 服务配置
 * @returns 连接是否成功
 */
export async function testAIConnection(config: AIServiceConfig): Promise<boolean> {
  try {
    if (config.modelType === AIModelTypeEnum.GEMINI) {
      const model = createGeminiModel(config)
      await withAIRequestTimeout(() => model.generateContent('Hello'))
      return true
    }

    await openaiGet(config, '/models')
    return true
  } catch (error) {
    console.error('AI connection test failed:', error)
    return false
  }
}

/**
 * 获取可用的 AI 模型列表
 * @param config - AI 服务配置
 * @returns 模型名称数组，失败时返回空数组
 */
export async function fetchAvailableModels(config: AIServiceConfig): Promise<string[]> {
  try {
    if (config.modelType === AIModelTypeEnum.GEMINI) {
      const url = `https://generativelanguage.googleapis.com/v1/models?key=${config.apiKey}`
      const response = await withAIRequestTimeout(() => fetch(url))
      if (!response.ok) {
        throw new Error(`Failed to fetch Gemini models: ${response.status}`)
      }
      const data = (await response.json()) as { models?: Array<{ name: string }> }
      return data.models?.map((model) => model.name.replace('models/', '')) || []
    }

    const data = (await openaiGet(config, '/models')) as { data?: Array<{ id: string }> }
    return data.data?.map((model) => model.id) || []
  } catch (error) {
    console.error('Failed to fetch models:', error)
    return []
  }
}
