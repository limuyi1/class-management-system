import { GoogleGenerativeAI } from '@google/generative-ai'
import { AIModelTypeEnum, type AIModelTypeEnum as AIModelType } from '@/types/AIConfig'

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

interface StudentData {
  name: string
  tags?: string[]
  score?: number
  comment?: string | null
}

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

interface ScoreResult {
  name: string
  score: number | null
}

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
