/** 标签和标签分类生成。 */
import { generateText } from '@/ai/providers'
import { replaceTemplate } from '@/ai/promptUtil'
import { parseArrayWithFallback } from '@/ai/responseHelpers'

import type { AIServiceConfig } from '@/ai/types'

/**
 * AI 生成学生标签
 * @param category - 标签分类
 * @param count - 生成数量
 * @param requirement - 附加要求
 * @param prompt - 提示词模板
 * @param config - AI 服务配置
 * @returns 生成的标签数组
 */
export async function generateTags(
  category: string,
  count: number,
  requirement: string,
  prompt: string,
  config: AIServiceConfig
): Promise<string[]> {
  const promptText = replaceTemplate(prompt, {
    category,
    count,
    requirement: requirement || '无特殊要求'
  })

  const responseText = await generateText(config, promptText)
  return parseArrayWithFallback<string>(responseText, [], 'generateTags')
}

/**
 * AI 生成学生标签分类
 * @param count - 生成数量
 * @param requirement - 附加要求
 * @param prompt - 提示词模板
 * @param config - AI 服务配置
 * @returns 生成的分类数组
 */
export async function generateTagCategories(
  count: number,
  requirement: string,
  prompt: string,
  config: AIServiceConfig
): Promise<string[]> {
  const promptText = replaceTemplate(prompt, {
    count,
    requirement: requirement || '无特殊要求'
  })

  const responseText = await generateText(config, promptText)
  return parseArrayWithFallback<string>(responseText, [], 'generateTagCategories')
}
