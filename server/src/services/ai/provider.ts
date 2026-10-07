import { requestAIJson } from './transport.js'
import { BusinessError } from '../errors.js'
export interface AIProviderInputType {
  provider: 'OPENAI' | 'GEMINI'
  baseUrl: string
  model: string
  key: string
  prompt: string
  image?: { mimeType: string; data: string }
  signal?: AbortSignal
  maxOutput: number
}
export interface AIProviderResultType {
  text: string
  inputTokens: number
  outputTokens: number
}
/** 适配 OpenAI 兼容与 Gemini REST；供应商回报用量，禁止使用客户端填写的账单。 */
export async function invokeAI(input: AIProviderInputType): Promise<AIProviderResultType> {
  let data: unknown
  if (input.provider === 'GEMINI') {
    const parts: unknown[] = [{ text: input.prompt }]
    if (input.image) parts.push({ inlineData: input.image })
    data = await requestAIJson(
      new URL(`${input.baseUrl}/models/${encodeURIComponent(input.model)}:generateContent`),
      { 'x-goog-api-key': input.key },
      {
        contents: [{ role: 'user', parts }],
        generationConfig: { maxOutputTokens: input.maxOutput }
      },
      input.signal
    )
    const result = data as {
      candidates?: { content?: { parts?: { text?: string }[] } }[]
      usageMetadata?: {
        promptTokenCount?: number
        candidatesTokenCount?: number
        totalTokenCount?: number
      }
    }
    const usage = result.usageMetadata
    return checked(
      result.candidates?.[0]?.content?.parts?.map((part) => part.text || '').join('') || '',
      usage?.promptTokenCount,
      usage?.totalTokenCount === undefined || usage.promptTokenCount === undefined
        ? undefined
        : usage.totalTokenCount - usage.promptTokenCount
    )
  }
  const content: unknown = input.image
    ? [
        { type: 'text', text: input.prompt },
        {
          type: 'image_url',
          image_url: { url: `data:${input.image.mimeType};base64,${input.image.data}` }
        }
      ]
    : input.prompt
  data = await requestAIJson(
    new URL(`${input.baseUrl}/chat/completions`),
    { Authorization: `Bearer ${input.key}` },
    {
      model: input.model,
      messages: [{ role: 'user', content }],
      max_tokens: input.maxOutput,
      temperature: 0.5,
      stream: false
    },
    input.signal
  )
  const result = data as {
    choices?: { message?: { content?: string } }[]
    usage?: { prompt_tokens?: number; completion_tokens?: number }
  }
  return checked(
    result.choices?.[0]?.message?.content || '',
    result.usage?.prompt_tokens,
    result.usage?.completion_tokens
  )
}
function checked(text: string, inputTokens?: number, outputTokens?: number): AIProviderResultType {
  if (
    !text ||
    !Number.isSafeInteger(inputTokens) ||
    !Number.isSafeInteger(outputTokens) ||
    inputTokens! < 0 ||
    outputTokens! < 0
  )
    throw new BusinessError(
      502,
      'AI_USAGE_UNCERTAIN',
      '模型未返回可确认的内容或用量，请核对调用记录'
    )
  return { text, inputTokens: inputTokens!, outputTokens: outputTokens! }
}
