/** 单张和多张图片的模型请求。 */
import { AIModelTypeEnum } from '@/types/AIConfig'
import {
  createGeminiModel,
  getContentFromOpenAIResponse,
  openaiPost,
  withAIRequestTimeout
} from '@/ai/providers'

import type { AIServiceConfig } from '@/ai/types'

/**
 * 根据单张图片生成文本（视觉识别）
 * @param config - AI 服务配置
 * @param prompt - 提示词
 * @param imageBase64 - 图片 base64 数据
 * @returns 模型返回的文本
 */
export async function generateVisionText(
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
    const result = await withAIRequestTimeout(() => model.generateContent([prompt, imagePart]))
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

/**
 * 根据多张图片生成文本（视觉识别）
 * @param config - AI 服务配置
 * @param prompt - 提示词
 * @param questionImages - 图片 base64 数据数组
 * @returns 模型返回的文本
 */
export async function generateVisionTextWithMultiImages(
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

    const result = await withAIRequestTimeout(() => model.generateContent(contents))
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
