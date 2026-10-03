/** 题目识别与答案解析生成。 */
import { replaceTemplate } from '@/ai/promptUtil'
import { parseObjectWithFallback } from '@/ai/responseHelpers'
import { generateVisionText, generateVisionTextWithMultiImages } from '@/ai/visionRequestService'

import type { AIServiceConfig } from '@/ai/types'
import type { QuestionRecognitionResultType, AnswerGenerateResultType } from '@/types/AIService'

/**
 * 从图片中识别错题题目
 * @param imageBase64 - 图片 base64 数据
 * @param config - AI 服务配置
 * @returns 识别出的题目信息
 */
export async function recognizeQuestionFromImage(
  imageBase64: string,
  config: AIServiceConfig
): Promise<QuestionRecognitionResultType> {
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

  const fallback: QuestionRecognitionResultType = {
    question: '',
    answer: '',
    hasImage: false
  }

  const parsed = parseObjectWithFallback<Partial<QuestionRecognitionResultType>>(
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
 * @param questionText - 题目内容
 * @param questionImages - 题目图片 base64 数据数组
 * @param config - AI 服务配置
 * @returns 生成的答案与解析
 */
export async function generateAnswerFromQuestion(
  questionText: string,
  questionImages: string[],
  config: AIServiceConfig
): Promise<AnswerGenerateResultType> {
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

  const parsed = parseObjectWithFallback<Partial<AnswerGenerateResultType>>(
    responseText,
    { answer: '', explanation: '' },
    'generateAnswerFromQuestion'
  )

  return {
    answer: parsed.answer || '',
    explanation: parsed.explanation || ''
  }
}
