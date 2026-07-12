import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

import { useAIConfigStore } from '../../src/stores/ai-config'
import { DefaultAIPrompts } from '../../src/types/AIConfig'

describe('useAIConfigStore prompt reset', () => {
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
