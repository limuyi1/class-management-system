import { ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

import { useOverviewAnalysis } from '@/views/overview/composables/useOverviewAnalysis'
import { useAIConfigStore } from '@/stores/ai-config'
import { useOverviewAnalysisStore } from '@/stores/overview-analysis'
import { NAME_PROP } from '@/constants'
import { overviewDashboardConfig } from '@/views/overview/constants/dashboard'
import { buildDashboardData } from '@/views/overview/services/dashboard'

import type { SettingType } from '@/types/Setting'
import type { StudentDataType } from '@/types/StudentData'

/**
 * useOverviewAnalysis 组合式函数测试
 * 测试目标：总览页 AI 学情分析生成
 * 覆盖功能：AI 未配置短路、提示词载荷组装、成功写入 store、失败提示、loading 状态
 */

const aiServiceMocks = vi.hoisted(() => ({
  generateLearningAnalysis: vi.fn()
}))
vi.mock('@/ai/aiService', () => aiServiceMocks)

const messageMocks = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn()
}))
vi.mock('element-plus', () => ({
  ElMessage: messageMocks
}))

/** 构造最小可用的总览展示数据 */
const buildFixtureData = () => {
  const unitHeaders: SettingType[] = [
    { prop: 'unit1', label: '第一单元', disabled: false },
    { prop: 'unit2', label: '第二单元', disabled: false }
  ]
  const students: StudentDataType[] = [
    { studentId: 's1', [NAME_PROP]: '张三', unit1: 88, unit2: 92 },
    { studentId: 's2', [NAME_PROP]: '李四', unit1: 76, unit2: 80 }
  ]
  return buildDashboardData({
    students,
    unitHeaders,
    selectedStudentIds: ['s1'],
    aiConfigured: false,
    config: overviewDashboardConfig
  })
}

describe('useOverviewAnalysis', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    aiServiceMocks.generateLearningAnalysis.mockReset()
    messageMocks.success.mockClear()
    messageMocks.error.mockClear()
  })

  it('returns false without calling AI when AI is not configured', async () => {
    const aiConfigStore = useAIConfigStore()
    aiConfigStore.apiKey = ''
    const hook = useOverviewAnalysis(ref(buildFixtureData()))

    const success = await hook.generateAnalysis()

    expect(success).toBe(false)
    expect(aiServiceMocks.generateLearningAnalysis).not.toHaveBeenCalled()
  })

  it('sends the trimmed payload to AI and stores the result', async () => {
    const aiConfigStore = useAIConfigStore()
    aiConfigStore.apiKey = 'sk-test'
    aiServiceMocks.generateLearningAnalysis.mockResolvedValue('  分析内容  ')
    const hook = useOverviewAnalysis(ref(buildFixtureData()))

    const success = await hook.generateAnalysis()

    expect(success).toBe(true)
    const [payload] = aiServiceMocks.generateLearningAnalysis.mock.calls[0]
    expect(payload).toMatchObject({
      指标概览: expect.objectContaining({ 班级均分: 84 }),
      概览卡片: expect.any(Array),
      单元表现: expect.any(Array),
      教学提示: expect.any(Array),
      关注分组: expect.any(Array),
      重点学生名单: expect.any(Array)
    })
    expect(useOverviewAnalysisStore().analysisText).toBe('分析内容')
    expect(messageMocks.success).toHaveBeenCalledWith('AI 学情分析已生成')
  })

  it('shows an error message and returns false when AI fails', async () => {
    const aiConfigStore = useAIConfigStore()
    aiConfigStore.apiKey = 'sk-test'
    aiServiceMocks.generateLearningAnalysis.mockRejectedValue(new Error('网络错误'))
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const hook = useOverviewAnalysis(ref(buildFixtureData()))

    const success = await hook.generateAnalysis()

    expect(success).toBe(false)
    expect(messageMocks.error).toHaveBeenCalledWith('生成学情分析失败，请检查 AI 配置')
    expect(useOverviewAnalysisStore().analysisText).toBe('')
    consoleSpy.mockRestore()
  })

  it('toggles the loading state during generation', async () => {
    const aiConfigStore = useAIConfigStore()
    aiConfigStore.apiKey = 'sk-test'
    let resolveRequest: (value: string) => void = () => {}
    aiServiceMocks.generateLearningAnalysis.mockImplementation(
      () => new Promise<string>((resolve) => (resolveRequest = resolve))
    )
    const hook = useOverviewAnalysis(ref(buildFixtureData()))

    const pending = hook.generateAnalysis()
    expect(hook.loading.value).toBe(true)

    resolveRequest('完成')
    await pending
    expect(hook.loading.value).toBe(false)
  })

  it('exposes analysis text and timestamp from the store', async () => {
    const aiConfigStore = useAIConfigStore()
    aiConfigStore.apiKey = 'sk-test'
    aiServiceMocks.generateLearningAnalysis.mockResolvedValue('新分析')
    const hook = useOverviewAnalysis(ref(buildFixtureData()))

    await hook.generateAnalysis()

    expect(hook.analysisText.value).toBe('新分析')
    expect(hook.generatedAt.value).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })
})
