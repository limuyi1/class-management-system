import { GoogleGenerativeAI } from '@google/generative-ai'
import { AIModelTypeEnum, type AIPromptsType } from '@/types/AIConfig'

/**
 * AI 服务模块
 * 提供与各种 AI 模型（Gemini、OpenAI 兼容 API）交互的接口
 * 支持生成评语、识别图片成绩、生成标签等功能
 */

interface AIServiceConfig {
  modelType: AIModelTypeEnum
  model: string
  apiKey: string
  baseUrl: string
  prompts?: AIPromptsType
}

async function openaiFetch(
  config: AIServiceConfig,
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

async function openaiGet(config: AIServiceConfig, endpoint: string): Promise<any> {
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
export async function testAIConnection(config: AIServiceConfig): Promise<boolean> {
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
export async function fetchAvailableModels(config: AIServiceConfig): Promise<string[]> {
  try {
    if (config.modelType === AIModelTypeEnum.GEMINI) {
      const url = `https://generativelanguage.googleapis.com/v1/models?key=${config.apiKey}`
      const response = await fetch(url)
      if (!response.ok) {
        throw new Error(`Failed to fetch Gemini models: ${response.status}`)
      }
      const data = await response.json()
      return data.models?.map((m: any) => m.name.replace('models/', '')) || []
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
  config: AIServiceConfig
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
  config: AIServiceConfig
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
  config: AIServiceConfig
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
  config: AIServiceConfig
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

/**
 * 从图片中识别错题题目
 * 使用 AI 视觉能力识别图片中的题目信息
 * @param imageBase64 - 图片的 Base64 编码
 * @param config - AI 配置信息
 * @returns 识别结果，包含题目、答案、解析、题型等
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
        return {
          question: responseText,
          answer: '',
          hasImage: false
        }
      }

      const parsed = JSON.parse(jsonMatch[0])
      return {
        question: parsed.question || '',
        answer: parsed.answer || '',
        explanation: parsed.explanation,
        questionType: parsed.questionType,
        hasImage: parsed.hasImage ?? false
      }
    } catch (error) {
      console.error('Failed to parse image recognition response:', error)
      return {
        question: '',
        answer: '',
        hasImage: false
      }
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
      return {
        question: responseText,
        answer: '',
        hasImage: false
      }
    }

    const parsed = JSON.parse(jsonMatch[0])
    return {
      question: parsed.question || '',
      answer: parsed.answer || '',
      explanation: parsed.explanation,
      questionType: parsed.questionType,
      hasImage: parsed.hasImage ?? false
    }
  } catch (error) {
    console.error('Failed to parse image recognition response:', error)
    return {
      question: '',
      answer: '',
      hasImage: false
    }
  }
}

/**
 * 从题目内容和图片生成答案和解析
 * 使用 AI 分析题目并生成详细的答案和解析
 * @param questionText - 题目文本内容
 * @param questionImages - 题目图片 Base64 数组
 * @param config - AI 配置信息
 * @returns 生成的答案和解析
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

  if (config.modelType === AIModelTypeEnum.GEMINI) {
    const genAI = new GoogleGenerativeAI(config.apiKey)
    const model = genAI.getGenerativeModel({ model: config.model || 'gemini-2.0-flash' })

    const contents: any[] = [prompt]
    for (const img of questionImages) {
      contents.push({
        inlineData: {
          data: img,
          mimeType: 'image/png'
        }
      })
    }

    const result = await model.generateContent(contents)
    const responseText = result.response.text()

    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        console.error('No JSON found in response:', responseText)
        return { answer: '', explanation: '' }
      }

      const parsed = JSON.parse(jsonMatch[0])
      return {
        answer: parsed.answer || '',
        explanation: parsed.explanation || ''
      }
    } catch (error) {
      console.error('Failed to parse answer generation response:', error)
      return { answer: '', explanation: '' }
    }
  }

  const messages: any[] = []
  const userContent: any[] = [{ type: 'text', text: prompt }]

  for (const img of questionImages) {
    userContent.push({ type: 'image_url', image_url: { url: `data:image/png;base64,${img}` } })
  }

  messages.push({ role: 'user', content: userContent })

  const data = await openaiFetch(config, '/chat/completions', {
    model: config.model,
    messages,
    temperature: 0.3
  })

  const responseText = data.choices[0]?.message?.content || '{}'

  try {
    const jsonMatch = responseText.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      console.error('No JSON found in response:', responseText)
      return { answer: '', explanation: '' }
    }

    const parsed = JSON.parse(jsonMatch[0])
    return {
      answer: parsed.answer || '',
      explanation: parsed.explanation || ''
    }
  } catch (error) {
    console.error('Failed to parse answer generation response:', error)
    return { answer: '', explanation: '' }
  }
}
