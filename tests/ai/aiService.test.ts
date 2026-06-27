import { beforeEach, describe, expect, it, vi } from 'vitest'

import { AIModelTypeEnum } from '../../src/types/AIConfig'

const { generateTextMock } = vi.hoisted(() => ({
  generateTextMock: vi.fn()
}))

vi.mock('../../src/ai/providers', () => ({
  createGeminiModel: vi.fn(),
  generateText: generateTextMock,
  getContentFromOpenAIResponse: vi.fn(),
  openaiGet: vi.fn(),
  openaiPost: vi.fn()
}))

describe('aiService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('parses batch polish comments from JSON response', async () => {
    generateTextMock.mockResolvedValueOnce(
      JSON.stringify([
        { name: '张三', comment: '润色后评语' },
        { name: '李四', comment: '润色后评语二' }
      ])
    )

    const { polishBatchComments } = await import('../../src/ai/aiService')
    const result = await polishBatchComments(
      [
        { name: '张三', tags: '认真', comment: '原评语' },
        { name: '李四', tags: '积极', comment: '原评语二' }
      ],
      '请润色以下评语：{{students}}',
      {
        modelType: AIModelTypeEnum.OPENAI,
        model: 'test-model',
        apiKey: 'test-key',
        baseUrl: 'https://example.com/v1'
      }
    )

    expect(result).toEqual([
      { name: '张三', comment: '润色后评语' },
      { name: '李四', comment: '润色后评语二' }
    ])
    expect(generateTextMock).toHaveBeenCalledTimes(1)
    expect(generateTextMock.mock.calls[0]?.[1]).toContain('请润色以下评语')
    expect(generateTextMock.mock.calls[0]?.[1]).toContain('"comment": "原评语"')
  })
})
