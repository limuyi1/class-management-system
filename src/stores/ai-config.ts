import { defineStore } from 'pinia'

import {
  AIModelTypeEnum,
  AIModelDefaultBaseUrls,
  AIModelDefaultModels,
  DefaultAIPrompts,
  type AIConfigType,
  type AIPromptsType
} from '@/types/AIConfig'

interface AIConfigState extends AIConfigType {
  availableModels: string[]
}

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
      this.prompts = { ...DefaultAIPrompts, ...this.prompts, ...prompts }
    },
    resetPrompt(promptKey: keyof AIPromptsType) {
      this.prompts[promptKey] = DefaultAIPrompts[promptKey]
    },
    resetPrompts() {
      this.prompts = { ...DefaultAIPrompts }
    }
  }
})
