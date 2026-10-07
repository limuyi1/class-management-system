/** 期末评语生成与润色。 */
import { DefaultAIPrompts } from '@/types/AIConfig'
import { generateText } from '@/ai/providers'
import {
  replaceTemplate,
  normalizeTagsForPrompt,
  buildCommentStudentPayload,
  buildStudentIdentityGuidance,
  buildClassicExpressionUsageGuidance
} from '@/ai/promptUtil'
import { parseArrayWithFallback } from '@/ai/responseHelpers'

import type { AIServiceConfig } from '@/ai/types'
import type {
  AIStudentDataType,
  BatchCommentOptionsType,
  BatchCommentResultType,
  PolishedCommentResultType
} from '@/types/AIService'

/**
 * 为单个学生生成评语
 * @param student - 学生数据
 * @param prompt - 提示词模板
 * @param config - AI 服务配置
 * @returns 生成的评语
 */
export async function generateSingleComment(
  student: AIStudentDataType,
  prompt: string,
  config: AIServiceConfig
): Promise<string> {
  const promptText = replaceTemplate(prompt, {
    name: student.name,
    tags: normalizeTagsForPrompt(student.tags),
    score: '不提供成绩信息'
  })

  return generateText(config, promptText)
}

/**
 * 基于已有评语进行单个润色
 * @param student - 学生数据（含原始评语）
 * @param prompt - 提示词模板
 * @param config - AI 服务配置
 * @returns 润色后的评语
 */
export async function polishSingleComment(
  student: AIStudentDataType,
  prompt: string,
  config: AIServiceConfig
): Promise<string> {
  const promptText = replaceTemplate(prompt || DefaultAIPrompts.singleCommentPolish, {
    name: student.name,
    tags: normalizeTagsForPrompt(student.tags),
    comment: student.comment || ''
  })

  return generateText(config, promptText)
}

/**
 * 批量生成学生评语
 * @param students - 学生数据列表
 * @param prompt - 提示词模板
 * @param config - AI 服务配置
 * @param options - 附加选项（经典表达频率控制）
 * @returns 每个学生的评语结果
 */
export async function generateBatchComments(
  students: AIStudentDataType[],
  prompt: string,
  config: AIServiceConfig,
  options?: BatchCommentOptionsType
): Promise<BatchCommentResultType[]> {
  const studentsJson = JSON.stringify(students.map(buildCommentStudentPayload), null, 2)
  const promptText =
    replaceTemplate(prompt, {
      students: studentsJson
    }) +
    buildStudentIdentityGuidance() +
    buildClassicExpressionUsageGuidance(options)

  const responseText = await generateText(config, promptText)
  const parsed = parseArrayWithFallback<{
    studentId: string
    name: string
    comment: string
    classicExpression?: string
  }>(responseText, [], 'generateBatchComments')

  const resultMap = new Map(parsed.map((item) => [item.studentId, item]))

  return students.map((student) => ({
    ...student,
    comment: resultMap.get(student.studentId || '')?.comment || student.comment,
    classicExpression: resultMap.get(student.studentId || '')?.classicExpression
  }))
}

/**
 * 批量润色已有学生评语
 * @param students - 学生数据列表（含原始评语）
 * @param prompt - 提示词模板
 * @param config - AI 服务配置
 * @param options - 附加选项（经典表达频率控制）
 * @returns 每个学生的润色结果
 */
export async function polishBatchComments(
  students: AIStudentDataType[],
  prompt: string,
  config: AIServiceConfig,
  options?: BatchCommentOptionsType
): Promise<PolishedCommentResultType[]> {
  const studentsJson = JSON.stringify(students, null, 2)
  const promptText =
    replaceTemplate(prompt || DefaultAIPrompts.batchCommentPolish, {
      students: studentsJson
    }) +
    buildStudentIdentityGuidance() +
    buildClassicExpressionUsageGuidance(options)

  const responseText = await generateText(config, promptText)
  return parseArrayWithFallback<PolishedCommentResultType>(responseText, [], 'polishBatchComments')
}
