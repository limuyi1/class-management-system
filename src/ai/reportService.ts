/** 学生报告正文与班级学情分析。 */
import { generateText } from '@/ai/providers'
import { formatTemplateValue, replaceTemplate } from '@/ai/promptUtil'

import type { AIServiceConfig } from '@/ai/types'
import type { AIStudentDataType } from '@/types/AIService'

/**
 * 生成学生阶段学习报告正文
 * @param student - 学生数据
 * @param config - AI 服务配置
 * @returns 生成的报告正文
 */
export async function generateStudentReportSummary(
  student: AIStudentDataType,
  config: AIServiceConfig
): Promise<string> {
  const scoreDetail = Array.isArray(student.score)
    ? JSON.stringify(student.score, null, 2)
    : student.score
  const promptText = `你是一位小学班主任，请根据以下学生阶段成绩信息，生成一份适合展示给家长查看的学习报告正文。

学生姓名：${student.name}
学生标签：${formatTemplateValue(student.tags || [])}
成绩数据：${formatTemplateValue(scoreDetail)}

写作要求：
1. 只输出正文，不要标题，不要 Markdown，不要项目符号。
2. 分成 3 段，每段 1-2 句，总字数控制在 140-220 字。
3. 语言自然、客观、温和，强调阶段表现与变化趋势。
4. 可以提到提升、波动、稳定性，但不要写“家长建议”“老师建议”“仅供参考”等提示语。
5. 不要捏造没有提供的数据，不要出现系统、AI、模板等字样。`

  return generateText(config, promptText)
}

/**
 * 生成班级学情分析
 * @param dashboard - 学情面板数据
 * @param prompt - 提示词模板
 * @param config - AI 服务配置
 * @returns 生成的分析文本
 */
export async function generateLearningAnalysis(
  dashboard: Record<string, unknown>,
  prompt: string,
  config: AIServiceConfig
): Promise<string> {
  const promptText = replaceTemplate(prompt, {
    dashboard: JSON.stringify(dashboard, null, 2)
  })

  return generateText(config, promptText)
}
