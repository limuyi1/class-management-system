import { ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  formatEvaluationBatchTags,
  useEvaluationBatchComments
} from '@/views/evaluation/composables/useEvaluationBatchComments'
import { AIModelTypeEnum, DefaultAIPrompts, type AIConfigType } from '@/types/AIConfig'
import type { StudentDataType } from '@/types/StudentData'
import type { TagCategoryType } from '@/types/Setting'

const aiServiceMocks = vi.hoisted(() => ({
  generateBatchComments: vi.fn(),
  polishBatchComments: vi.fn()
}))

const loadingMocks = vi.hoisted(() => ({
  close: vi.fn(),
  setText: vi.fn()
}))

const messageBoxMocks = vi.hoisted(() => ({
  confirm: vi.fn()
}))

const messageMocks = vi.hoisted(() => ({
  error: vi.fn(),
  success: vi.fn(),
  warning: vi.fn()
}))

vi.mock('@/ai/aiService', () => aiServiceMocks)

vi.mock('element-plus', () => ({
  ElLoading: {
    service: vi.fn(() => loadingMocks)
  },
  ElMessage: messageMocks,
  ElMessageBox: messageBoxMocks
}))

interface TestAIConfigType extends AIConfigType {
  isConfigured: boolean
}

const createAIConfig = (isConfigured = true): TestAIConfigType => ({
  isConfigured,
  modelType: AIModelTypeEnum.OPENAI,
  model: 'gpt-test',
  apiKey: isConfigured ? 'key' : '',
  baseUrl: 'https://example.test',
  prompts: { ...DefaultAIPrompts }
})

const tagCategoryList: TagCategoryType[] = [{ prop: 'behavior', label: '表现' }]

const createStudent = (
  name: string,
  overrides: Partial<StudentDataType> = {}
): StudentDataType => ({
  xing4_ming2: name,
  tags: {
    behavior: ['认真']
  },
  ...overrides
})

const createComment = (length = 105): string => '这'.repeat(length)

describe('useEvaluationBatchComments', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    messageBoxMocks.confirm.mockResolvedValue('confirm')
    aiServiceMocks.generateBatchComments.mockResolvedValue([])
    aiServiceMocks.polishBatchComments.mockResolvedValue([])
  })

  it('should format unique non-empty tags for batch prompts', () => {
    expect(formatEvaluationBatchTags(['认真', ' ', '认真', '积极'])).toBe('认真、积极')
    expect(formatEvaluationBatchTags([])).toBe('')
  })

  it('should warn when AI is not configured', async () => {
    const hook = useEvaluationBatchComments({
      students: ref([createStudent('张三')]),
      tagCategoryList: ref(tagCategoryList),
      aiConfig: createAIConfig(false)
    })

    await hook.handleBatchGenerate()

    expect(messageMocks.warning).toHaveBeenCalledWith('请先在设置页面配置 AI')
    expect(aiServiceMocks.generateBatchComments).not.toHaveBeenCalled()
  })

  it('should fill only blank comments when partial existing comments are skipped', async () => {
    const students = ref([
      createStudent('张三', { comment: '已有评语' }),
      createStudent('李四', { comment: '' })
    ])
    messageBoxMocks.confirm.mockRejectedValue('cancel')
    const generatedComment = createComment()
    aiServiceMocks.generateBatchComments.mockResolvedValue([
      { name: '李四', comment: generatedComment }
    ])
    const hook = useEvaluationBatchComments({
      students,
      tagCategoryList: ref(tagCategoryList),
      aiConfig: createAIConfig()
    })

    await hook.handleBatchGenerate()

    expect(aiServiceMocks.generateBatchComments).toHaveBeenCalledWith(
      [
        {
          name: '李四',
          tags: '认真',
          comment: ''
        }
      ],
      DefaultAIPrompts.batchComment,
      expect.objectContaining({ apiKey: 'key' })
    )
    expect(students.value.map((student) => student.comment)).toEqual(['已有评语', generatedComment])
    expect(messageMocks.success).toHaveBeenCalledWith('批量生成完成，已更新 1 条期末评语')
    expect(loadingMocks.close).toHaveBeenCalled()
  })

  it('should apply generated comments by student name when AI returns shuffled results', async () => {
    const zhangComment = createComment(101)
    const liComment = createComment(102)
    const students = ref([createStudent('张三'), createStudent('李四')])
    aiServiceMocks.generateBatchComments.mockResolvedValue([
      { name: '李四', comment: liComment },
      { name: '张三', comment: zhangComment }
    ])
    const hook = useEvaluationBatchComments({
      students,
      tagCategoryList: ref(tagCategoryList),
      aiConfig: createAIConfig()
    })

    await hook.handleBatchGenerate()

    expect(students.value.map((student) => student.comment)).toEqual([zhangComment, liComment])
    expect(messageMocks.success).toHaveBeenCalledWith('批量生成完成，已更新 2 条期末评语')
  })

  it('should skip generated comments shorter than 100 chars', async () => {
    const validComment = createComment()
    const students = ref([createStudent('张三'), createStudent('李四')])
    aiServiceMocks.generateBatchComments.mockResolvedValue([
      { name: '张三', comment: '太短' },
      { name: '李四', comment: validComment }
    ])
    const hook = useEvaluationBatchComments({
      students,
      tagCategoryList: ref(tagCategoryList),
      aiConfig: createAIConfig()
    })

    await hook.handleBatchGenerate()

    expect(students.value.map((student) => student.comment)).toEqual([undefined, validComment])
    expect(messageMocks.warning).toHaveBeenCalledWith('有 1 条评语少于 100 字，已跳过写入')
    expect(messageMocks.success).toHaveBeenCalledWith('批量生成完成，已更新 1 条期末评语')
  })

  it('should allow generated comments longer than 120 chars', async () => {
    const longComment = createComment(130)
    const students = ref([createStudent('张三')])
    aiServiceMocks.generateBatchComments.mockResolvedValue([{ name: '张三', comment: longComment }])
    const hook = useEvaluationBatchComments({
      students,
      tagCategoryList: ref(tagCategoryList),
      aiConfig: createAIConfig()
    })

    await hook.handleBatchGenerate()

    expect(students.value[0].comment).toBe(longComment)
    expect(messageMocks.success).toHaveBeenCalledWith('批量生成完成，已更新 1 条期末评语')
  })

  it('should polish existing comments and keep blank comments unchanged', async () => {
    const students = ref([
      createStudent('张三', { comment: '原评语' }),
      createStudent('李四', { comment: '' })
    ])
    aiServiceMocks.polishBatchComments.mockResolvedValue([{ name: '张三', comment: '润色评语' }])
    const hook = useEvaluationBatchComments({
      students,
      tagCategoryList: ref(tagCategoryList),
      aiConfig: createAIConfig()
    })

    await hook.handleBatchPolish()

    expect(messageBoxMocks.confirm).toHaveBeenCalled()
    expect(aiServiceMocks.polishBatchComments).toHaveBeenCalledWith(
      [
        {
          name: '张三',
          tags: '认真',
          comment: '原评语'
        }
      ],
      DefaultAIPrompts.batchCommentPolish,
      expect.objectContaining({ model: 'gpt-test' })
    )
    expect(students.value.map((student) => student.comment)).toEqual(['润色评语', ''])
    expect(messageMocks.success).toHaveBeenCalledWith('批量润色完成，已更新 1 条期末评语')
    expect(loadingMocks.close).toHaveBeenCalled()
  })
})
