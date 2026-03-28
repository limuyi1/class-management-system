import { defineStore } from 'pinia'

import {
  AIModelTypeEnum,
  AIModelDefaultBaseUrls,
  AIModelDefaultModels,
  DefaultAIPrompts,
  type AIPromptsType
} from '@/types/AIConfig'

export const useAIConfigStore = defineStore('aiConfig', {
  state: () => ({
    modelType: AIModelTypeEnum.GEMINI as AIModelTypeEnum,
    model: AIModelDefaultModels[AIModelTypeEnum.GEMINI],
    apiKey: '',
    baseUrl: AIModelDefaultBaseUrls[AIModelTypeEnum.GEMINI],
    prompts: { ...DefaultAIPrompts } as AIPromptsType,
    availableModels: [] as string[]
  }),
  getters: {
    isConfigured: (state) => {
      return state.apiKey.trim().length > 0
    }
  },
  actions: {
    setModelType(type: AIModelTypeEnum) {
      this.modelType = type
      this.baseUrl = AIModelDefaultBaseUrls[type]
      this.model = AIModelDefaultModels[type]
      this.availableModels = []
    },
    setModel(model: string) {
      this.model = model
    },
    setAvailableModels(models: string[]) {
      this.availableModels = models
    },
    updatePrompts(prompts: Partial<AIPromptsType>) {
      this.prompts = { ...this.prompts, ...prompts }
    },
    resetPrompts() {
      this.prompts = { ...DefaultAIPrompts }
    }
  },
  persist: true
})
