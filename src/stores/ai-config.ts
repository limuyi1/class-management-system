import { defineStore } from 'pinia'

import {
  AIModelTypeEnum,
  AIModelDefaultBaseUrls,
  AIModelDefaultModels,
  DefaultAIPrompts,
  type AIConfigType,
  type AIPromptsType
} from '@/types/AIConfig'

/** AI 配置状态（含运行时可用模型列表） */
interface AIConfigState extends AIConfigType {
  availableModels: string[]
}

/**
 * AI 配置状态管理
 * 管理 AI 模型选择、API Key、Prompt 模板等配置
 */
export const useAIConfigStore = defineStore('aiConfig', {
  state: (): AIConfigState => ({
    modelType: AIModelTypeEnum.OPENAI,
    model: AIModelDefaultModels[AIModelTypeEnum.OPENAI],
    apiKey: '',
    baseUrl: AIModelDefaultBaseUrls[AIModelTypeEnum.OPENAI],
    prompts: { ...DefaultAIPrompts },
    availableModels: []
  }),
  getters: {
    /** 判断 AI 是否已配置（API Key 非空） */
    isConfigured: (state) => {
      return state.apiKey.trim().length > 0
    }
  },
  actions: {
    /** 切换 AI 提供商，自动更新默认地址和模型 */
    setModelType(type: AIModelTypeEnum) {
      this.modelType = type
      this.baseUrl = AIModelDefaultBaseUrls[type]
      this.model = AIModelDefaultModels[type]
      this.availableModels = []
    },
    /**
     * 设置当前使用的模型
     * @param model - 模型名称
     */
    setModel(model: string) {
      this.model = model
    },
    /**
     * 设置可选的模型列表
     * @param models - 模型名称数组
     */
    setAvailableModels(models: string[]) {
      this.availableModels = models
    },
    /** 合并更新 Prompt 配置 */
    updatePrompts(prompts: Partial<AIPromptsType>) {
      this.prompts = { ...DefaultAIPrompts, ...this.prompts, ...prompts }
    },
    /** 确保缺失 Prompt 使用默认值 */
    ensureDefaultPrompts() {
      this.prompts = { ...DefaultAIPrompts, ...this.prompts }
    },
    /** 重置单个 Prompt 为默认值 */
    resetPrompt(promptKey: keyof AIPromptsType) {
      this.prompts[promptKey] = DefaultAIPrompts[promptKey]
    },
    /** 重置所有 Prompt 为默认值 */
    resetPrompts() {
      this.prompts = { ...DefaultAIPrompts }
    }
  }
})
