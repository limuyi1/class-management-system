import { GoogleGenerativeAI } from '@google/generative-ai'

import { AIModelTypeEnum } from '@/types/AIConfig'
import type { AIServiceConfig } from '@/ai/types'

export const AI_REQUEST_TIMEOUT_MS = 120_000

export class AIRequestTimeoutError extends Error {
  constructor(timeoutMs: number = AI_REQUEST_TIMEOUT_MS) {
    super(`AI 请求超时，请稍后重试或减少生成数量（已等待 ${Math.round(timeoutMs / 1000)} 秒）`)
    this.name = 'AIRequestTimeoutError'
  }
}

export async function withAIRequestTimeout<T>(
  request: () => Promise<T>,
  timeoutMs: number = AI_REQUEST_TIMEOUT_MS
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined

  try {
    return await Promise.race([
      request(),
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new AIRequestTimeoutError(timeoutMs)), timeoutMs)
      })
    ])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

export async function openaiPost(
  config: AIServiceConfig,
  endpoint: string,
  body: Record<string, unknown>
): Promise<unknown> {
  const url = `${config.baseUrl}${endpoint}`
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), AI_REQUEST_TIMEOUT_MS)

  let response: Response
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`
      },
      body: JSON.stringify(body),
      signal: controller.signal
    })
  } catch (error) {
    if (controller.signal.aborted) {
      throw new AIRequestTimeoutError()
    }
    throw error
  } finally {
    clearTimeout(timer)
  }

  if (!response.ok) {
    throw new Error(`API request failed: ${response.status} ${response.statusText}`)
  }

  return response.json()
}

export async function openaiGet(config: AIServiceConfig, endpoint: string): Promise<unknown> {
  const url = `${config.baseUrl}${endpoint}`
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), AI_REQUEST_TIMEOUT_MS)

  let response: Response
  try {
    response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${config.apiKey}`
      },
      signal: controller.signal
    })
  } catch (error) {
    if (controller.signal.aborted) {
      throw new AIRequestTimeoutError()
    }
    throw error
  } finally {
    clearTimeout(timer)
  }

  if (!response.ok) {
    throw new Error(`API request failed: ${response.status} ${response.statusText}`)
  }

  return response.json()
}

export function createGeminiModel(config: AIServiceConfig) {
  const genAI = new GoogleGenerativeAI(config.apiKey)
  return genAI.getGenerativeModel({ model: config.model || 'gemini-2.0-flash' })
}

export async function generateText(config: AIServiceConfig, prompt: string): Promise<string> {
  if (config.modelType === AIModelTypeEnum.GEMINI) {
    const model = createGeminiModel(config)
    const result = await withAIRequestTimeout(() => model.generateContent(prompt))
    return result.response.text()
  }

  const data = await openaiPost(config, '/chat/completions', {
    model: config.model,
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.7
  })

  return getContentFromOpenAIResponse(data)
}

interface OpenAIMessageType {
  content?: string
}

interface OpenAIChoiceType {
  message?: OpenAIMessageType
}

interface OpenAIResponseType {
  choices?: OpenAIChoiceType[]
}

export function getContentFromOpenAIResponse(data: unknown, fallback: string = ''): string {
  const response = data as OpenAIResponseType
  const content = response?.choices?.[0]?.message?.content
  return typeof content === 'string' ? content : fallback
}
