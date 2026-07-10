import { ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  formatEvaluationBatchTags,
  normalizeClassicExpression,
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
  studentId: `id-${name}`,
  name: name,
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

  it('should normalize classic expressions for usage counting', () => {
    expect(normalizeClassicExpression('“天下大事，必作于细。”')).toBe('天下大事，必作于细')
    expect(normalizeClassicExpression('')).toBe('')
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
      { studentId: 'id-李四', name: '李四', comment: generatedComment }
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
          studentId: 'id-李四',
          name: '李四',
          tags: '认真',
          comment: ''
        }
      ],
      DefaultAIPrompts.batchComment,
      expect.objectContaining({ apiKey: 'key' }),
      {
        classicExpressionUsages: [],
        maxClassicExpressionUsage: 2
      }
    )
    expect(students.value.map((student) => student.comment)).toEqual(['已有评语', generatedComment])
    expect(messageMocks.success).toHaveBeenCalledWith('批量生成完成，已更新 1 条期末评语')
    expect(loadingMocks.close).toHaveBeenCalled()
  })

  it('should apply generated comments by student ID when AI returns shuffled results', async () => {
    const zhangComment = createComment(101)
    const liComment = createComment(102)
    const students = ref([createStudent('张三'), createStudent('李四')])
    aiServiceMocks.generateBatchComments.mockResolvedValue([
      { studentId: 'id-李四', name: '李四', comment: liComment },
      { studentId: 'id-张三', name: '被模型改名', comment: zhangComment }
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
      { studentId: 'id-张三', name: '张三', comment: '太短' },
      { studentId: 'id-李四', name: '李四', comment: validComment }
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
    aiServiceMocks.generateBatchComments.mockResolvedValue([
      { studentId: 'id-张三', name: '张三', comment: longComment }
    ])
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
    aiServiceMocks.polishBatchComments.mockResolvedValue([
      { studentId: 'id-张三', name: '张三', comment: '润色评语' }
    ])
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
          studentId: 'id-张三',
          name: '张三',
          tags: '认真',
          comment: '原评语'
        }
      ],
      DefaultAIPrompts.batchCommentPolish,
      expect.objectContaining({ model: 'gpt-test' }),
      {
        classicExpressionUsages: [],
        maxClassicExpressionUsage: 2
      }
    )
    expect(students.value.map((student) => student.comment)).toEqual(['润色评语', ''])
    expect(messageMocks.success).toHaveBeenCalledWith('批量润色完成，已更新 1 条期末评语')
    expect(loadingMocks.close).toHaveBeenCalled()
  })

  it('should pass overused classic expressions to later generation batches', async () => {
    const students = ref(Array.from({ length: 6 }, (_, index) => createStudent(`学生${index + 1}`)))
    const generatedComment = createComment()
    aiServiceMocks.generateBatchComments
      .mockResolvedValueOnce([
        { studentId: 'id-学生1', name: '学生1', comment: generatedComment, classicExpression: '天下大事，必作于细' },
        { studentId: 'id-学生2', name: '学生2', comment: generatedComment, classicExpression: '天下大事，必作于细' },
        { studentId: 'id-学生3', name: '学生3', comment: generatedComment, classicExpression: '不积跬步，无以至千里' },
        { studentId: 'id-学生4', name: '学生4', comment: generatedComment, classicExpression: '' },
        { studentId: 'id-学生5', name: '学生5', comment: generatedComment, classicExpression: '日拱一卒' }
      ])
      .mockResolvedValueOnce([
        { studentId: 'id-学生6', name: '学生6', comment: generatedComment, classicExpression: '锲而不舍，金石可镂' }
      ])
    const hook = useEvaluationBatchComments({
      students,
      tagCategoryList: ref(tagCategoryList),
      aiConfig: createAIConfig()
    })

    await hook.handleBatchGenerate()

    expect(aiServiceMocks.generateBatchComments).toHaveBeenCalledTimes(2)
    expect(aiServiceMocks.generateBatchComments.mock.calls[1]?.[3]).toEqual({
      classicExpressionUsages: [{ expression: '天下大事，必作于细', count: 2 }],
      maxClassicExpressionUsage: 2
    })
  })
})
