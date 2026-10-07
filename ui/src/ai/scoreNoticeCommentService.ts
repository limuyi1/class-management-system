/** 成绩通知评语生成与结果归一化。 */
import { DefaultAIPrompts } from '@/types/AIConfig'
import { normalizeScoreNoticeComment } from '@/utils/score-notice/scoreNoticeCommentUtil'
import { generateText } from '@/ai/providers'
import { replaceTemplate } from '@/ai/promptUtil'
import { parseArrayWithFallback } from '@/ai/responseHelpers'

import type { AIServiceConfig } from '@/ai/types'
import type { ScoreNoticeCommentInputType, ScoreNoticeCommentResultType } from '@/types/AIService'

/**
 * 生成单个学生的成绩通知单评语
 * @param student - 学生成绩摘要
 * @param config - AI 服务配置
 * @param prompt - 提示词（默认使用内置模板）
 * @returns 生成的评语
 */
export async function generateScoreNoticeComment(
  student: ScoreNoticeCommentInputType,
  config: AIServiceConfig,
  prompt = DefaultAIPrompts.scoreNoticeSingleComment
): Promise<string> {
  const responseText = await generateText(
    config,
    replaceTemplate(prompt, { student: JSON.stringify(student, null, 2) })
  )
  return normalizeScoreNoticeComment(responseText)
}

/**
 * 批量生成成绩通知单评语
 * @param students - 学生成绩摘要列表
 * @param config - AI 服务配置
 * @param prompt - 提示词（默认使用内置模板）
 * @returns 每个学生的评语结果
 */
export async function generateScoreNoticeComments(
  students: ScoreNoticeCommentInputType[],
  config: AIServiceConfig,
  prompt = DefaultAIPrompts.scoreNoticeBatchComment
): Promise<ScoreNoticeCommentResultType[]> {
  const responseText = await generateText(
    config,
    replaceTemplate(prompt, { students: JSON.stringify(students, null, 2) })
  )
  const parsed = parseArrayWithFallback<ScoreNoticeCommentResultType>(
    responseText,
    [],
    'generateScoreNoticeComments'
  )
  const resultMap = new Map(
    parsed.map((item) => [item.studentId, normalizeScoreNoticeComment(item.comment || '')])
  )

  return students.map((student) => ({
    studentId: student.studentId,
    comment: resultMap.get(student.studentId) || ''
  }))
}
