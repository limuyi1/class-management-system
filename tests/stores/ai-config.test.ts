import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

import { useAIConfigStore } from '../../src/stores/ai-config'
import { DefaultAIPrompts } from '../../src/types/AIConfig'

/**
 * useAIConfigStore store 测试
 * 测试目标：AI 配置 store 的提示词重置逻辑
 * 覆盖功能：重置单个提示词、重置全部提示词（结果应为默认值的副本而非同一引用）
 */

// 验证提示词重置动作只影响目标提示词并返回默认值
describe('useAIConfigStore prompt reset', () => {
  // 每个用例前创建全新的 Pinia 实例，避免 store 状态互相污染
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('resets only the selected prompt', () => {
    const store = useAIConfigStore()
    store.prompts.singleComment = '自定义单个评语'
    store.prompts.batchComment = '自定义批量评语'

    store.resetPrompt('singleComment')

    expect(store.prompts.singleComment).toBe(DefaultAIPrompts.singleComment)
    expect(store.prompts.batchComment).toBe('自定义批量评语')
  })

  it('resets all prompts to defaults', () => {
    const store = useAIConfigStore()
    store.prompts.singleComment = '自定义单个评语'
    store.prompts.batchComment = '自定义批量评语'
    store.prompts.imageScore = '自定义图片识别'

    store.resetPrompts()

    expect(store.prompts).toEqual(DefaultAIPrompts)
    expect(store.prompts).not.toBe(DefaultAIPrompts)
  })
})
