import { generateScoreNoticeComment, generateScoreNoticeComments } from '@/ai/aiService'
import { useAIConfigStore } from '@/stores/ai-config'
import { useDataSourceStore } from '@/stores/data-source'
import { useScoreNoticeStore } from '@/stores/score-notice'
import { useSettingStore } from '@/stores/setting'
import {
  buildGradeSummary,
  buildTemplateScoreNoticeComment,
  normalizeScoreNoticeComment
} from '@/utils/score-notice/scoreNoticeCommentUtil'

import type { AIServiceConfig } from '@/ai/types'
import type { StudentDataType } from '@/types/StudentData'
import type { ScoreNoticeStudentType } from '@/types/ScoreNotice'
import type { ScoreNoticeCommentInputType } from '@/ai/aiService'

/** 归纳学生信息与调用评语服务，页面只负责请求进度和草稿确认。 */
export function useScoreNoticeComments() {
  const store = useScoreNoticeStore()
  const aiConfigStore = useAIConfigStore()
  const dataStore = useDataSourceStore()
  const settingStore = useSettingStore()
  /** 优先按系统 ID 关联，旧导入数据缺少 ID 时才回退为姓名匹配。 */
  const findSourceStudent = (student: ScoreNoticeStudentType): StudentDataType | undefined => {
    if (student.sourceStudentId) {
      return dataStore.enabledData.find((item) => item.studentId === student.sourceStudentId)
    }
    return undefined
  }

  /** 依据历史成绩变化归纳出趋势描述 */
  const resolveTrendSummary = (student: ScoreNoticeStudentType): string => {
    const sourceStudent = findSourceStudent(student)
    if (!sourceStudent) return '暂无可靠的历史变化信息'
    const scores = settingStore.enabledScoreColumns
      .map((column) => sourceStudent[column.prop])
      .filter((value): value is number => typeof value === 'number' && Number.isFinite(value))
    if (scores.length < 2) return '历史数据较少，重点评价本次表现'
    const difference = scores[scores.length - 1] - scores[0]
    if (difference >= 5) return '近期整体呈进步趋势'
    if (difference <= -5) return '近期状态有所回落，需要温和提醒'
    const range = Math.max(...scores) - Math.min(...scores)
    return range >= 12 ? '近期表现存在一定波动' : '近期表现较为稳定'
  }

  /** 汇总学生的日常表现标签文本 */
  const resolveTagSummary = (student: ScoreNoticeStudentType): string => {
    const sourceStudent = findSourceStudent(student)
    if (!sourceStudent?.tags) return '暂无日常表现标签'
    return Object.values(sourceStudent.tags).flat().filter(Boolean).join('、') || '暂无日常表现标签'
  }

  /** 组装 AI 评语所需的输入数据 */
  const buildAIInput = (student: ScoreNoticeStudentType): ScoreNoticeCommentInputType => ({
    studentId: student.id,
    name: student.name,
    gradeSummary: buildGradeSummary(student, store.subjects),
    trendSummary: resolveTrendSummary(student),
    tags: resolveTagSummary(student)
  })

  /** 获取当前 AI 服务配置 */
  const getAIServiceConfig = (): AIServiceConfig => ({
    modelType: aiConfigStore.modelType,
    model: aiConfigStore.model,
    apiKey: aiConfigStore.apiKey,
    baseUrl: aiConfigStore.baseUrl
  })

  /**
   * 为一批学生生成评语并写入 store。
   * 未配置 AI 时回退为模板评语。
   * @param students 待生成评语的学生列表
   */
  const generateForStudents = async (students: ScoreNoticeStudentType[]): Promise<void> => {
    if (!aiConfigStore.isConfigured) {
      students.forEach((student) => {
        store.updateStudentComment(
          student.id,
          normalizeScoreNoticeComment(buildTemplateScoreNoticeComment(student, store.subjects)),
          false
        )
      })
      return
    }

    const config = getAIServiceConfig()
    if (students.length === 1) {
      const student = students[0]
      const comment = await generateScoreNoticeComment(
        buildAIInput(student),
        config,
        aiConfigStore.prompts.scoreNoticeSingleComment
      )
      store.updateStudentComment(student.id, comment, false)
      return
    }

    const results = await generateScoreNoticeComments(
      students.map(buildAIInput),
      config,
      aiConfigStore.prompts.scoreNoticeBatchComment
    )
    const resultMap = new Map(results.map((item) => [item.studentId, item.comment]))
    students.forEach((student) => {
      const comment = resultMap.get(student.id) || ''
      store.updateStudentComment(student.id, comment, false)
    })
  }

  /** 生成单条评语草稿（未配置 AI 时返回模板评语） */
  const generateSingleDraft = async (student: ScoreNoticeStudentType): Promise<string> => {
    if (!aiConfigStore.isConfigured) {
      return normalizeScoreNoticeComment(buildTemplateScoreNoticeComment(student, store.subjects))
    }

    return generateScoreNoticeComment(
      buildAIInput(student),
      getAIServiceConfig(),
      aiConfigStore.prompts.scoreNoticeSingleComment
    )
  }

  return { generateForStudents, generateSingleDraft }
}
