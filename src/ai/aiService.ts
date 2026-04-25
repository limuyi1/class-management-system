import { AIModelTypeEnum } from '@/types/AIConfig'

import type { AIServiceConfig } from '@/ai/types'
import {
  createGeminiModel,
  generateText,
  getContentFromOpenAIResponse,
  openaiGet,
  openaiPost
} from '@/ai/providers'
import { parseJsonArray, parseJsonObject } from '@/ai/responseParser'

/**
 * AI 服务模块
 * 提供与各种 AI 模型（Gemini、OpenAI 兼容 API）交互的接口
 * 支持生成评语、识别图片成绩、生成标签等功能
 */

interface StudentData {
  name: string
  tags?: string[]
  /**
   * 单人评语沿用单个成绩，批量评语允许传入结构化成绩数组。
   */
  score?: number | Array<{ label: string; value: number }>
  comment?: string | null
}

interface ScoreResult {
  name: string
  score: number | null
}

interface QuestionResult {
  question: string
  answer: string
  explanation?: string
  questionType?: string
  hasImage: boolean
}

interface AnswerGenerateResult {
  answer: string
  explanation: string
}

function formatTemplateValue(value: unknown): string {
  if (Array.isArray(value)) {
    if (!value.length) return '暂无'

    const containsObject = value.some((item) => typeof item === 'object' && item !== null)
    return containsObject ? JSON.stringify(value, null, 2) : value.join('、')
  }

  if (value === null || value === undefined) {
    return '暂无'
  }

  return String(value)
}

function replaceTemplate(template: string, data: Record<string, unknown>): string {
  let result = template
  for (const [key, value] of Object.entries(data)) {
    const regex = new RegExp(`{{${key}}}`, 'g')
    result = result.replace(regex, formatTemplateValue(value))
  }
  return result
}

function parseObjectWithFallback<T>(responseText: string, fallback: T, scene: string): T {
  const parsed = parseJsonObject<T>(responseText)
  if (parsed) return parsed
  console.error(`[AI] ${scene}: failed to parse object from response`, responseText)
  return fallback
}

function parseArrayWithFallback<T>(responseText: string, fallback: T[], scene: string): T[] {
  const parsed = parseJsonArray<T>(responseText)
  if (parsed) return parsed
  console.error(`[AI] ${scene}: failed to parse array from response`, responseText)
  return fallback
}

async function generateVisionText(
  config: AIServiceConfig,
  prompt: string,
  imageBase64: string
): Promise<string> {
  if (config.modelType === AIModelTypeEnum.GEMINI) {
    const model = createGeminiModel(config)
    const imagePart = {
      inlineData: {
        data: imageBase64,
        mimeType: 'image/png'
      }
    }
    const result = await model.generateContent([prompt, imagePart])
    return result.response.text()
  }

  const data = await openaiPost(config, '/chat/completions', {
    model: config.model,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          { type: 'image_url', image_url: { url: `data:image/png;base64,${imageBase64}` } }
        ]
      }
    ],
    temperature: 0.3
  })

  return getContentFromOpenAIResponse(data, '{}')
}

async function generateVisionTextWithMultiImages(
  config: AIServiceConfig,
  prompt: string,
  questionImages: string[]
): Promise<string> {
  if (config.modelType === AIModelTypeEnum.GEMINI) {
    const model = createGeminiModel(config)
    const contents: Array<string | { inlineData: { data: string; mimeType: string } }> = [prompt]
    for (const image of questionImages) {
      contents.push({
        inlineData: {
          data: image,
          mimeType: 'image/png'
        }
      })
    }

    const result = await model.generateContent(contents)
    return result.response.text()
  }

  const userContent: Array<
    { type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } }
  > = [{ type: 'text', text: prompt }]

  for (const image of questionImages) {
    userContent.push({
      type: 'image_url',
      image_url: { url: `data:image/png;base64,${image}` }
    })
  }

  const data = await openaiPost(config, '/chat/completions', {
    model: config.model,
    messages: [{ role: 'user', content: userContent }],
    temperature: 0.3
  })

  return getContentFromOpenAIResponse(data, '{}')
}

/**
 * 测试 AI 连接是否可用
 */
export async function testAIConnection(config: AIServiceConfig): Promise<boolean> {
  try {
    if (config.modelType === AIModelTypeEnum.GEMINI) {
      const model = createGeminiModel(config)
      await model.generateContent('Hello')
      return true
    }

    await openaiGet(config, '/models')
    return true
  } catch (error) {
    console.error('AI connection test failed:', error)
    return false
  }
}

/**
 * 获取可用的 AI 模型列表
 */
export async function fetchAvailableModels(config: AIServiceConfig): Promise<string[]> {
  try {
    if (config.modelType === AIModelTypeEnum.GEMINI) {
      const url = `https://generativelanguage.googleapis.com/v1/models?key=${config.apiKey}`
      const response = await fetch(url)
      if (!response.ok) {
        throw new Error(`Failed to fetch Gemini models: ${response.status}`)
      }
      const data = (await response.json()) as { models?: Array<{ name: string }> }
      return data.models?.map((model) => model.name.replace('models/', '')) || []
    }

    const data = (await openaiGet(config, '/models')) as { data?: Array<{ id: string }> }
    return data.data?.map((model) => model.id) || []
  } catch (error) {
    console.error('Failed to fetch models:', error)
    return []
  }
}

/**
 * 为单个学生生成评语
 */
export async function generateSingleComment(
  student: StudentData,
  prompt: string,
  config: AIServiceConfig
): Promise<string> {
  const promptText = replaceTemplate(prompt, {
    name: student.name,
    tags: student.tags || [],
    score: student.score ?? null
  })

  return generateText(config, promptText)
}

/**
 * 批量生成学生评语
 */
export async function generateBatchComments(
  students: StudentData[],
  prompt: string,
  config: AIServiceConfig
): Promise<StudentData[]> {
  const studentsJson = JSON.stringify(students, null, 2)
  const promptText = replaceTemplate(prompt, {
    students: studentsJson
  })

  const responseText = await generateText(config, promptText)
  const parsed = parseArrayWithFallback<{ name: string; comment: string }>(
    responseText,
    [],
    'generateBatchComments'
  )

  const resultMap = new Map(parsed.map((item) => [item.name, item.comment]))

  return students.map((student) => ({
    ...student,
    comment: resultMap.get(student.name) || student.comment
  }))
}

/**
 * 从图片中识别学生成绩
 */
export async function recognizeScoreFromImage(
  imageBase64: string,
  prompt: string,
  config: AIServiceConfig
): Promise<ScoreResult[]> {
  const responseText = await generateVisionText(config, prompt, imageBase64)
  const parsed = parseObjectWithFallback<{ students?: ScoreResult[] }>(
    responseText,
    { students: [] },
    'recognizeScoreFromImage'
  )
  return parsed.students || []
}

/**
 * AI 生成学生标签
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
 * 生成班级学情分析
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

/**
 * 从图片中识别错题题目
 */
export async function recognizeQuestionFromImage(
  imageBase64: string,
  config: AIServiceConfig
): Promise<QuestionResult> {
  const prompt = `你是一个智能题目录入助手。请仔细识别图片中的数学题目，并按以下JSON格式返回结果：
{
  "question": "题目内容",
  "answer": "答案",
  "explanation": "解析（可选）",
  "questionType": "题型，如：选择题、填空题、解答题、应用题、计算题等",
  "hasImage": true/false - 图片中是否包含重要的图形、图像、图表等（几何题、函数图像等必须标为true）
}
注意：
1. 如果图片中有几何图形、函数图像、图表等，请确保在hasImage字段返回true
2. 如果图片不清晰或无法识别，请返回合理的默认值
3. 题目内容请保持原文，只提取文字部分，不要包含图片描述
4. 如果有多个题目，请只返回第一个题目的信息
5. 返回的内容为标准的markdown格式
6. 公式使用 $formula$ 格式（这是 LaTeX 公式标记，会在后续渲染）`

  const responseText = await generateVisionText(config, prompt, imageBase64)

  const fallback: QuestionResult = {
    question: '',
    answer: '',
    hasImage: false
  }

  const parsed = parseObjectWithFallback<Partial<QuestionResult>>(
    responseText,
    fallback,
    'recognizeQuestionFromImage'
  )

  return {
    question: parsed.question || '',
    answer: parsed.answer || '',
    explanation: parsed.explanation,
    questionType: parsed.questionType,
    hasImage: parsed.hasImage ?? false
  }
}

/**
 * 从题目内容和图片生成答案和解析
 */
export async function generateAnswerFromQuestion(
  questionText: string,
  questionImages: string[],
  config: AIServiceConfig
): Promise<AnswerGenerateResult> {
  const imageHint = questionImages.length > 0 ? '（题目包含图片，请结合图片理解题目）' : ''

  const defaultPrompt = `你是一位专业的小学数学老师。请根据以下题目内容，生成详细的答案和解析。

题目：{{question}}
{{imageHint}}

请返回JSON格式：
{
  "answer": "答案内容",
  "explanation": "详细解析，包含解题步骤和思路"
}

要求：
1. 答案要准确、简洁
2. 解析要详细，包含解题步骤和思路分析
3. 如果是选择题或填空题，直接给出答案
4. 如果是解答题，要给出完整解题过程
5. 使用通俗易懂的语言，符合小学生认知水平
6. 适当使用数学公式（用LaTeX格式表示）
7. 仅返回JSON对象，不要有其他文字`

  const prompt = replaceTemplate(config.prompts?.answerGenerate || defaultPrompt, {
    question: questionText,
    imageHint
  })

  const responseText = await generateVisionTextWithMultiImages(config, prompt, questionImages)

  const parsed = parseObjectWithFallback<Partial<AnswerGenerateResult>>(
    responseText,
    { answer: '', explanation: '' },
    'generateAnswerFromQuestion'
  )

  return {
    answer: parsed.answer || '',
    explanation: parsed.explanation || ''
  }
}
