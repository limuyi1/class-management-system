import { GoogleGenerativeAI } from '@google/generative-ai'
import { AIModelTypeEnum, type AIModelTypeEnum as AIModelType } from '@/types/AIConfig'

/**
 * AI 服务模块
 * 提供与各种 AI 模型（Gemini、OpenAI 兼容 API）交互的接口
 * 支持生成评语、识别图片成绩、生成标签等功能
 */

/**
 * AI 配置接口
 */
interface AIConfig {
  modelType: AIModelType
  model: string
  apiKey: string
  baseUrl: string
}

async function openaiFetch(
  config: AIConfig,
  endpoint: string,
  body: Record<string, any>
): Promise<any> {
  const url = `${config.baseUrl}${endpoint}`
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`
    },
    body: JSON.stringify(body)
  })

  if (!response.ok) {
    throw new Error(`API request failed: ${response.status} ${response.statusText}`)
  }

  return response.json()
}

async function openaiGet(config: AIConfig, endpoint: string): Promise<any> {
  const url = `${config.baseUrl}${endpoint}`
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${config.apiKey}`
    }
  })

  if (!response.ok) {
    throw new Error(`API request failed: ${response.status} ${response.statusText}`)
  }

  return response.json()
}

/**
 * 测试 AI 连接是否可用
 * @param config - AI 配置信息
 * @returns 连接是否成功
 */
export async function testAIConnection(config: AIConfig): Promise<boolean> {
  try {
    if (config.modelType === AIModelTypeEnum.GEMINI) {
      const genAI = new GoogleGenerativeAI(config.apiKey)
      const model = genAI.getGenerativeModel({ model: config.model || 'gemini-2.0-flash' })
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
 * @param config - AI 配置信息
 * @returns 模型 ID 数组
 */
export async function fetchAvailableModels(config: AIConfig): Promise<string[]> {
  try {
    if (config.modelType === AIModelTypeEnum.GEMINI) {
      return []
    }

    const data = await openaiGet(config, '/models')
    return data.data?.map((m: any) => m.id) || []
  } catch (error) {
    console.error('Failed to fetch models:', error)
    return []
  }
}

/**
 * 学生数据接口
 * 用于传递学生信息给 AI 生成评语
 */
interface StudentData {
  name: string
  tags?: string[]
  score?: number
  comment?: string | null
}

/**
 * 替换模板占位符
 * 将模板中的 {{key}} 占位符替换为实际数据
 * 数组类型会用顿号连接，null/undefined 会替换为"暂无"
 * @param template - 模板字符串
 * @param data - 数据对象
 * @returns 替换后的字符串
 */
function replaceTemplate(template: string, data: Record<string, any>): string {
  let result = template
  for (const [key, value] of Object.entries(data)) {
    const regex = new RegExp(`{{${key}}}`, 'g')
    if (Array.isArray(value)) {
      result = result.replace(regex, value.join('、'))
    } else if (value === null || value === undefined) {
      result = result.replace(regex, '暂无')
    } else {
      result = result.replace(regex, String(value))
    }
  }
  return result
}

/**
 * 为单个学生生成评语
 * @param student - 学生数据
 * @param prompt - AI 提示词模板
 * @param config - AI 配置信息
 * @returns 生成的评语文本
 */
export async function generateSingleComment(
  student: StudentData,
  prompt: string,
  config: AIConfig
): Promise<string> {
  const promptText = replaceTemplate(prompt, {
    name: student.name,
    tags: student.tags || [],
    score: student.score ?? null
  })

  if (config.modelType === AIModelTypeEnum.GEMINI) {
    const genAI = new GoogleGenerativeAI(config.apiKey)
    const model = genAI.getGenerativeModel({ model: config.model || 'gemini-2.0-flash' })
    const result = await model.generateContent(promptText)
    return result.response.text()
  }

  const data = await openaiFetch(config, '/chat/completions', {
    model: config.model,
    messages: [{ role: 'user', content: promptText }],
    temperature: 0.7
  })

  return data.choices[0]?.message?.content || ''
}

/**
 * 批量生成学生评语
 * @param students - 学生数据数组
 * @param prompt - AI 提示词模板
 * @param config - AI 配置信息
 * @returns 更新后的学生数据数组（包含生成的评语）
 */
export async function generateBatchComments(
  students: StudentData[],
  prompt: string,
  config: AIConfig
): Promise<StudentData[]> {
  const studentsJson = JSON.stringify(students, null, 2)
  const promptText = replaceTemplate(prompt, {
    students: studentsJson
  })

  let responseText: string

  if (config.modelType === AIModelTypeEnum.GEMINI) {
    const genAI = new GoogleGenerativeAI(config.apiKey)
    const model = genAI.getGenerativeModel({ model: config.model || 'gemini-2.0-flash' })
    const result = await model.generateContent(promptText)
    responseText = result.response.text()
  } else {
    const data = await openaiFetch(config, '/chat/completions', {
      model: config.model,
      messages: [{ role: 'user', content: promptText }],
      temperature: 0.7
    })

    responseText = data.choices[0]?.message?.content || '[]'
  }

  try {
    const jsonMatch = responseText.match(/\[[\s\S]*\]/)
    if (!jsonMatch) {
      console.error('No JSON found in response:', responseText)
      return students
    }

    const parsed = JSON.parse(jsonMatch[0]) as Array<{ name: string; comment: string }>

    const resultMap = new Map(parsed.map((item) => [item.name, item.comment]))

    return students.map((student) => ({
      ...student,
      comment: resultMap.get(student.name) || student.comment
    }))
  } catch (error) {
    console.error('Failed to parse batch comments response:', error)
    return students
  }
}

/**
 * 成绩识别结果
 */
interface ScoreResult {
  name: string
  score: number | null
}

/**
 * 从图片中识别学生成绩
 * 使用 AI 视觉能力识别图片中的成绩信息
 * @param imageBase64 - 图片的 Base64 编码
 * @param prompt - AI 提示词模板
 * @param config - AI 配置信息
 * @returns 识别结果数组，包含学生姓名和分数
 */
export async function recognizeScoreFromImage(
  imageBase64: string,
  prompt: string,
  config: AIConfig
): Promise<ScoreResult[]> {
  if (config.modelType === AIModelTypeEnum.GEMINI) {
    const genAI = new GoogleGenerativeAI(config.apiKey)
    const model = genAI.getGenerativeModel({ model: config.model || 'gemini-2.0-flash' })

    const imagePart = {
      inlineData: {
        data: imageBase64,
        mimeType: 'image/png'
      }
    }

    const result = await model.generateContent([prompt, imagePart])
    const responseText = result.response.text()

    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        console.error('No JSON found in response:', responseText)
        return []
      }

      const parsed = JSON.parse(jsonMatch[0])
      return parsed.students || []
    } catch (error) {
      console.error('Failed to parse image recognition response:', error)
      return []
    }
  }

  const data = await openaiFetch(config, '/chat/completions', {
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

  const responseText = data.choices[0]?.message?.content || '{}'

  try {
    const jsonMatch = responseText.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      console.error('No JSON found in response:', responseText)
      return []
    }

    const parsed = JSON.parse(jsonMatch[0])
    return parsed.students || []
  } catch (error) {
    console.error('Failed to parse image recognition response:', error)
    return []
  }
}

/**
 * AI 生成学生标签
 * @param category - 标签分类名称
 * @param count - 生成的标签数量
 * @param requirement - 特殊需求描述
 * @param prompt - AI 提示词模板
 * @param config - AI 配置信息
 * @returns 生成的标签数组
 */
export async function generateTags(
  category: string,
  count: number,
  requirement: string,
  prompt: string,
  config: AIConfig
): Promise<string[]> {
  const promptText = replaceTemplate(prompt, {
    category,
    count,
    requirement: requirement || '无特殊要求'
  })

  let responseText: string

  if (config.modelType === AIModelTypeEnum.GEMINI) {
    const genAI = new GoogleGenerativeAI(config.apiKey)
    const model = genAI.getGenerativeModel({ model: config.model || 'gemini-2.0-flash' })
    const result = await model.generateContent(promptText)
    responseText = result.response.text()
  } else {
    const data = await openaiFetch(config, '/chat/completions', {
      model: config.model,
      messages: [{ role: 'user', content: promptText }],
      temperature: 0.7
    })

    responseText = data.choices[0]?.message?.content || '[]'
  }

  try {
    const jsonMatch = responseText.match(/\[[\s\S]*\]/)
    if (!jsonMatch) {
      console.error('No JSON found in response:', responseText)
      return []
    }

    const parsed = JSON.parse(jsonMatch[0])
    return Array.isArray(parsed) ? parsed : []
  } catch (error) {
    console.error('Failed to parse generate tags response:', error)
    return []
  }
}
