/**
 * aiService 测试
 * 覆盖：单条/批量评语生成与批量润色的提示词组装规则（不向 AI 传入具体分数、空标签处理、经典表达频率控制），
 * 以及 AI JSON 响应的解析（批量润色结果、标签分类生成）。
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

import { AIModelTypeEnum } from '../../src/types/AIConfig'

// 用 vi.hoisted 提前创建 mock 函数，使 vi.mock 工厂与测试用例共享同一引用
const { generateTextMock } = vi.hoisted(() => ({
  generateTextMock: vi.fn()
}))

// 完整 mock AI providers，测试不发起真实网络请求
vi.mock('../../src/ai/providers', () => ({
  createGeminiModel: vi.fn(),
  generateText: generateTextMock,
  getContentFromOpenAIResponse: vi.fn(),
  openaiGet: vi.fn(),
  openaiPost: vi.fn()
}))

// 目标：验证各生成函数渲染提示词模板与解析响应时，分数剥离、空标签、经典表达控制等规则是否生效
describe('aiService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('does not pass concrete scores to single comment prompts', async () => {
    generateTextMock.mockResolvedValueOnce('生成评语')

    const { generateSingleComment } = await import('../../src/ai/aiService')
    await generateSingleComment(
      { name: '张三', tags: ['认真'], score: 58 },
      '姓名：{{name}} 标签：{{tags}} 成绩：{{score}}',
      {
        modelType: AIModelTypeEnum.OPENAI,
        model: 'test-model',
        apiKey: 'test-key',
        baseUrl: 'https://example.com/v1'
      }
    )

    expect(generateTextMock.mock.calls[0]?.[1]).toContain('成绩：不提供成绩信息')
    expect(generateTextMock.mock.calls[0]?.[1]).not.toContain('58')
  })

  it('passes empty tags as blank text to single comment prompts', async () => {
    generateTextMock.mockResolvedValueOnce('生成评语')

    const { generateSingleComment } = await import('../../src/ai/aiService')
    await generateSingleComment(
      { name: '张三', tags: [] },
      '姓名：{{name}} 标签：{{tags}} 成绩：{{score}}',
      {
        modelType: AIModelTypeEnum.OPENAI,
        model: 'test-model',
        apiKey: 'test-key',
        baseUrl: 'https://example.com/v1'
      }
    )

    const promptText = generateTextMock.mock.calls[0]?.[1] || ''
    expect(promptText).toContain('标签： 成绩')
    expect(promptText).not.toContain('暂无')
  })

  it('strips score data from batch comment prompts', async () => {
    generateTextMock.mockResolvedValueOnce(
      JSON.stringify([{ studentId: 'student-1', name: '张三', comment: '生成评语' }])
    )

    const { generateBatchComments } = await import('../../src/ai/aiService')
    await generateBatchComments(
      [
        {
          studentId: 'student-1',
          name: '张三',
          tags: '认真',
          score: [{ label: '期末', value: 58 }],
          comment: ''
        }
      ],
      '请生成：{{students}}',
      {
        modelType: AIModelTypeEnum.OPENAI,
        model: 'test-model',
        apiKey: 'test-key',
        baseUrl: 'https://example.com/v1'
      }
    )

    const promptText = generateTextMock.mock.calls[0]?.[1] || ''
    expect(promptText).toContain('"name": "张三"')
    expect(promptText).toContain('"studentId": "student-1"')
    expect(promptText).not.toContain('score')
    expect(promptText).not.toContain('58')
  })

  it('keeps empty tags blank in batch comment payloads', async () => {
    generateTextMock.mockResolvedValueOnce(
      JSON.stringify([{ studentId: 'student-1', name: '张三', comment: '生成评语' }])
    )

    const { generateBatchComments } = await import('../../src/ai/aiService')
    await generateBatchComments(
      [{ studentId: 'student-1', name: '张三', tags: [], comment: '' }],
      '请生成：{{students}}',
      {
        modelType: AIModelTypeEnum.OPENAI,
        model: 'test-model',
        apiKey: 'test-key',
        baseUrl: 'https://example.com/v1'
      }
    )

    const promptText = generateTextMock.mock.calls[0]?.[1] || ''
    expect(promptText).toContain('"tags": ""')
    expect(promptText).not.toContain('暂无')
  })

  it('appends classic expression usage guidance to batch comment prompts', async () => {
    generateTextMock.mockResolvedValueOnce(
      JSON.stringify([
        {
          studentId: 'student-1',
          name: '张三',
          comment: '生成评语',
          classicExpression: '锲而不舍，金石可镂'
        }
      ])
    )

    const { generateBatchComments } = await import('../../src/ai/aiService')
    await generateBatchComments(
      [{ studentId: 'student-1', name: '张三', tags: '认真', comment: '' }],
      '请生成：{{students}}',
      {
        modelType: AIModelTypeEnum.OPENAI,
        model: 'test-model',
        apiKey: 'test-key',
        baseUrl: 'https://example.com/v1'
      },
      {
        classicExpressionUsages: [{ expression: '天下大事，必作于细', count: 2 }],
        maxClassicExpressionUsage: 2
      }
    )

    const promptText = generateTextMock.mock.calls[0]?.[1] || ''
    expect(promptText).toContain('经典表达频率控制')
    expect(promptText).toContain('天下大事，必作于细（已使用 2 次）')
    expect(promptText).toContain('classicExpression')
  })

  it('parses batch polish comments from JSON response', async () => {
    generateTextMock.mockResolvedValueOnce(
      JSON.stringify([
        { studentId: 'student-1', name: '张三', comment: '润色后评语' },
        { studentId: 'student-2', name: '李四', comment: '润色后评语二' }
      ])
    )

    const { polishBatchComments } = await import('../../src/ai/aiService')
    const result = await polishBatchComments(
      [
        { studentId: 'student-1', name: '张三', tags: '认真', comment: '原评语' },
        { studentId: 'student-2', name: '李四', tags: '积极', comment: '原评语二' }
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
      { studentId: 'student-1', name: '张三', comment: '润色后评语' },
      { studentId: 'student-2', name: '李四', comment: '润色后评语二' }
    ])
    expect(generateTextMock).toHaveBeenCalledTimes(1)
    expect(generateTextMock.mock.calls[0]?.[1]).toContain('请润色以下评语')
    expect(generateTextMock.mock.calls[0]?.[1]).toContain('"comment": "原评语"')
  })

  it('generates tag categories from JSON response', async () => {
    generateTextMock.mockResolvedValueOnce(JSON.stringify(['学习习惯', '课堂表现']))

    const { generateTagCategories } = await import('../../src/ai/aiService')
    const result = await generateTagCategories(2, '覆盖日常表现', '数量：{{count}} 要求：{{requirement}}', {
      modelType: AIModelTypeEnum.OPENAI,
      model: 'test-model',
      apiKey: 'test-key',
      baseUrl: 'https://example.com/v1'
    })

    expect(result).toEqual(['学习习惯', '课堂表现'])
    expect(generateTextMock.mock.calls[0]?.[1]).toContain('数量：2')
    expect(generateTextMock.mock.calls[0]?.[1]).toContain('要求：覆盖日常表现')
  })
})
