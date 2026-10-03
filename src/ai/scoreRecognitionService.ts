/** 成绩图片识别与姓名字段归一化。 */
import { DefaultAIPrompts } from '@/types/AIConfig'
import { replaceTemplate } from '@/ai/promptUtil'
import { parseObjectWithFallback } from '@/ai/responseHelpers'
import { generateVisionText } from '@/ai/visionRequestService'

import type { AIServiceConfig } from '@/ai/types'
import type { ScoreRecognitionResultType, VisionScoreResultType } from '@/types/AIService'

/** 识图姓名字段只接受非空字符串，其他值按无法辨认处理。 */
export function parseVisionName(value: unknown): string | null {
  return typeof value === 'string' ? value.trim() || null : null
}

/**
 * 从图片中识别学生成绩
 * @param imageBase64 - 图片 base64 数据
 * @param prompt - 提示词
 * @param config - AI 服务配置
 * @param studentNames - 当前启用学生姓名名单，仅供图片辨字参考
 * @returns 识别出的学生成绩列表
 */
export async function recognizeScoreFromImage(
  imageBase64: string,
  prompt: string,
  config: AIServiceConfig,
  studentNames: string[]
): Promise<ScoreRecognitionResultType[]> {
  const roster = JSON.stringify(studentNames)
  const template = prompt || DefaultAIPrompts.imageScore
  const promptWithRoster = template.includes('{{studentNames}}')
    ? replaceTemplate(template, { studentNames: roster })
    : `${template}\n\n当前启用学生名单（只作辨字参考）：${roster}`
  const scoreGuidance = `\n\n本次识别请以图片为准，名单只能用于辅助辨认，不得凭名单补造学生或分数。最终仅返回 JSON，例如：{"students":[{"rawName":"张三","matchedName":"张三","score":95}]}。图片姓名不在名单或无法确认时，matchedName 填 JSON null；无法辨认的原姓名或分数也填 JSON null，不要写成字符串。`
  const finalPrompt =
    template === DefaultAIPrompts.imageScore ? promptWithRoster : promptWithRoster + scoreGuidance
  const responseText = await generateVisionText(config, finalPrompt, imageBase64)
  const parsed = parseObjectWithFallback<{ students?: VisionScoreResultType[] }>(
    responseText,
    { students: [] },
    'recognizeScoreFromImage'
  )
  if (!Array.isArray(parsed.students)) return []
  return parsed.students
    .filter((item) => item !== null && typeof item === 'object')
    .map((item) => {
      const legacyName = parseVisionName(item.name)
      const rawName = 'rawName' in item ? parseVisionName(item.rawName) : legacyName
      const suggestedName = 'matchedName' in item ? parseVisionName(item.matchedName) : legacyName
      return {
        name: suggestedName || rawName || '',
        rawName,
        ...('matchedName' in item ? { matchedName: suggestedName } : {}),
        score: typeof item.score === 'number' ? item.score : null
      }
    })
}
