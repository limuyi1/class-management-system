import { AIModelTypeEnum, DefaultAIPrompts } from '@/types/AIConfig'
import { normalizeScoreNoticeComment } from '@/utils/scoreNoticeCommentUtil'

import type { AIServiceConfig } from '@/ai/types'
import {
  createGeminiModel,
  generateText,
  getContentFromOpenAIResponse,
  openaiGet,
  openaiPost,
  withAIRequestTimeout
} from '@/ai/providers'
import { parseJsonArray, parseJsonObject } from '@/ai/responseParser'

/**
 * AI 服务模块
 * 提供与各种 AI 模型（Gemini、OpenAI 兼容 API）交互的接口
 * 支持生成评语、识别图片成绩、生成标签等功能
 */

/** 传递给 AI 的学生数据 */
interface StudentData {
  studentId?: string
  name: string
  tags?: string | string[]
  score?: number | Array<{ label: string; value: number | null }>
  comment?: string | null
}

/** 经典表达使用情况 */
interface ClassicExpressionUsageType {
  expression: string
  count: number
}

/** 批量评语生成的附加选项 */
interface BatchCommentOptionsType {
  classicExpressionUsages?: ClassicExpressionUsageType[]
  maxClassicExpressionUsage?: number
}

/** 批量评语生成结果 */
interface BatchCommentResult extends StudentData {
  classicExpression?: string
}

/** 批量润色结果 */
interface PolishedCommentResult {
  studentId: string
  name: string
  comment: string
  classicExpression?: string
}

/** 图片识别的学生成绩结果 */
interface ScoreResult {
  name: string
  score: number | null
}

/** 图片识别的题目结果 */
interface QuestionResult {
  question: string
  answer: string
  explanation?: string
  questionType?: string
  hasImage: boolean
}

/** 题目答案与解析生成结果 */
interface AnswerGenerateResult {
  answer: string
  explanation: string
}

/** 成绩通知单单个学生评语生成的输入 */
export interface ScoreNoticeCommentInputType {
  studentId: string
  name: string
  gradeSummary: string
  trendSummary: string
  tags: string
}

/** 成绩通知单单个学生评语生成结果 */
export interface ScoreNoticeCommentResultType {
  studentId: string
  comment: string
}

/** 将模板占位值格式化为可读文本（数组拼接、空值返回「暂无」） */
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

/** 将模板中的 {{key}} 占位符替换为对应数据 */
function replaceTemplate(template: string, data: Record<string, unknown>): string {
  let result = template
  for (const [key, value] of Object.entries(data)) {
    const regex = new RegExp(`{{${key}}}`, 'g')
    result = result.replace(regex, formatTemplateValue(value))
  }
  return result
}

/** 将标签数据规范化为提示词所需的顿号分隔字符串 */
function normalizeTagsForPrompt(tags: StudentData['tags']): string {
  if (Array.isArray(tags)) {
    return tags
      .map((tag) => tag.trim())
      .filter(Boolean)
      .join('、')
  }

  return tags?.trim() || ''
}

/** 解析 JSON 对象，失败时返回兜底值并记录错误 */
function parseObjectWithFallback<T>(responseText: string, fallback: T, scene: string): T {
  const parsed = parseJsonObject<T>(responseText)
  if (parsed) return parsed
  console.error(`[AI] ${scene}: failed to parse object from response`, responseText)
  return fallback
}

/** 解析 JSON 数组，失败时返回兜底值并记录错误 */
function parseArrayWithFallback<T>(responseText: string, fallback: T[], scene: string): T[] {
  const parsed = parseJsonArray<T>(responseText)
  if (parsed) return parsed
  console.error(`[AI] ${scene}: failed to parse array from response`, responseText)
  return fallback
}

/** 构建批量评语请求中单个学生的载荷 */
function buildCommentStudentPayload(
  student: StudentData
): Pick<StudentData, 'studentId' | 'name' | 'tags' | 'comment'> {
  return {
    studentId: student.studentId,
    name: student.name,
    tags: normalizeTagsForPrompt(student.tags),
    comment: student.comment || ''
  }
}

/** 生成学生身份约束提示，确保模型按 studentId 返回结果 */
function buildStudentIdentityGuidance(): string {
  return `

学生身份约束：
1. 每条输入都包含 studentId，返回结果必须原样返回对应的 studentId。
2. 不得新增、删除、修改、交换 studentId。
3. 系统只按 studentId 写回结果，缺少 studentId 的结果将被忽略。`
}

/** 生成经典表达频率控制的提示 */
function buildClassicExpressionUsageGuidance(options?: BatchCommentOptionsType): string {
  const usages = options?.classicExpressionUsages || []
  if (!usages.length) return ''

  const maxUsage = options?.maxClassicExpressionUsage || 2
  const usageText = usages
    .map((item) => `- ${item.expression}（已使用 ${item.count} 次）`)
    .join('\n')

  return `\n\n经典表达频率控制：
1. 同一句经典表达在本次全班评语中最多使用 ${maxUsage} 次；达到 ${maxUsage} 次后，除非与学生标签和成长方向高度贴合，否则不要继续使用。
2. 同一批次内不得重复使用同一句经典表达。
3. 以下经典表达已在前面批次使用较多，本批次请优先避开：
${usageText}
4. 每条结果必须额外返回 classicExpression 字段，填写本条评语实际使用的经典表达；若确实未使用，则填空字符串。classicExpression 不要包含解释、出处或额外修饰。`
}

/**
 * 根据单张图片生成文本（视觉识别）
 * @param config - AI 服务配置
 * @param prompt - 提示词
 * @param imageBase64 - 图片 base64 数据
 * @returns 模型返回的文本
 */
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

/**
 * 测试 AI 连接是否可用
 * @param config - AI 服务配置
 * @returns 连接是否成功
 */
export async function testAIConnection(config: AIServiceConfig): Promise<boolean> {
  try {
    if (config.modelType === AIModelTypeEnum.GEMINI) {
      const model = createGeminiModel(config)
      await withAIRequestTimeout(() => model.generateContent('Hello'))
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
 * @param config - AI 服务配置
 * @returns 模型名称数组，失败时返回空数组
 */
export async function fetchAvailableModels(config: AIServiceConfig): Promise<string[]> {
  try {
    if (config.modelType === AIModelTypeEnum.GEMINI) {
      const url = `https://generativelanguage.googleapis.com/v1/models?key=${config.apiKey}`
      const response = await withAIRequestTimeout(() => fetch(url))
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
 * @param student - 学生数据
 * @param prompt - 提示词模板
 * @param config - AI 服务配置
 * @returns 生成的评语
 */
export async function generateSingleComment(
  student: StudentData,
  prompt: string,
  config: AIServiceConfig
): Promise<string> {
  const promptText = replaceTemplate(prompt, {
    name: student.name,
    tags: normalizeTagsForPrompt(student.tags),
    score: '不提供成绩信息'
  })

  return generateText(config, promptText)
}

/**
 * 基于已有评语进行单个润色
 * @param student - 学生数据（含原始评语）
 * @param prompt - 提示词模板
 * @param config - AI 服务配置
 * @returns 润色后的评语
 */
export async function polishSingleComment(
  student: StudentData,
  prompt: string,
  config: AIServiceConfig
): Promise<string> {
  const promptText = replaceTemplate(prompt || DefaultAIPrompts.singleCommentPolish, {
    name: student.name,
    tags: normalizeTagsForPrompt(student.tags),
    comment: student.comment || ''
  })

  return generateText(config, promptText)
}

/**
 * 生成学生阶段学习报告正文
 * @param student - 学生数据
 * @param config - AI 服务配置
 * @returns 生成的报告正文
 */
export async function generateStudentReportSummary(
  student: StudentData,
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
 * 批量生成学生评语
 * @param students - 学生数据列表
 * @param prompt - 提示词模板
 * @param config - AI 服务配置
 * @param options - 附加选项（经典表达频率控制）
 * @returns 每个学生的评语结果
 */
export async function generateBatchComments(
  students: StudentData[],
  prompt: string,
  config: AIServiceConfig,
  options?: BatchCommentOptionsType
): Promise<BatchCommentResult[]> {
  const studentsJson = JSON.stringify(students.map(buildCommentStudentPayload), null, 2)
  const promptText =
    replaceTemplate(prompt, {
      students: studentsJson
    }) +
    buildStudentIdentityGuidance() +
    buildClassicExpressionUsageGuidance(options)

  const responseText = await generateText(config, promptText)
  const parsed = parseArrayWithFallback<{
    studentId: string
    name: string
    comment: string
    classicExpression?: string
  }>(responseText, [], 'generateBatchComments')

  const resultMap = new Map(parsed.map((item) => [item.studentId, item]))

  return students.map((student) => ({
    ...student,
    comment: resultMap.get(student.studentId || '')?.comment || student.comment,
    classicExpression: resultMap.get(student.studentId || '')?.classicExpression
  }))
}

/**
 * 生成单个学生的成绩通知单评语
 * @param student - 学生成绩摘要
 * @param config - AI 服务配置
 * @param prompt - 提示词（默认使用内置模板）
 * @returns 生成的评语
 */
export async function generateScoreNoticeComment(
  student: ScoreNoticeCommentInputType,
  config: AIServiceConfig,
  prompt = DefaultAIPrompts.scoreNoticeSingleComment
): Promise<string> {
  const responseText = await generateText(
    config,
    replaceTemplate(prompt, { student: JSON.stringify(student, null, 2) })
  )
  return normalizeScoreNoticeComment(responseText)
}

/**
 * 批量生成成绩通知单评语
 * @param students - 学生成绩摘要列表
 * @param config - AI 服务配置
 * @param prompt - 提示词（默认使用内置模板）
 * @returns 每个学生的评语结果
 */
export async function generateScoreNoticeComments(
  students: ScoreNoticeCommentInputType[],
  config: AIServiceConfig,
  prompt = DefaultAIPrompts.scoreNoticeBatchComment
): Promise<ScoreNoticeCommentResultType[]> {
  const responseText = await generateText(
    config,
    replaceTemplate(prompt, { students: JSON.stringify(students, null, 2) })
  )
  const parsed = parseArrayWithFallback<ScoreNoticeCommentResultType>(
    responseText,
    [],
    'generateScoreNoticeComments'
  )
  const resultMap = new Map(
    parsed.map((item) => [item.studentId, normalizeScoreNoticeComment(item.comment || '')])
  )

  return students.map((student) => ({
    studentId: student.studentId,
    comment: resultMap.get(student.studentId) || ''
  }))
}

/**
 * 批量润色已有学生评语
 * @param students - 学生数据列表（含原始评语）
 * @param prompt - 提示词模板
 * @param config - AI 服务配置
 * @param options - 附加选项（经典表达频率控制）
 * @returns 每个学生的润色结果
 */
export async function polishBatchComments(
  students: StudentData[],
  prompt: string,
  config: AIServiceConfig,
  options?: BatchCommentOptionsType
): Promise<PolishedCommentResult[]> {
  const studentsJson = JSON.stringify(students, null, 2)
  const promptText =
    replaceTemplate(prompt || DefaultAIPrompts.batchCommentPolish, {
      students: studentsJson
    }) +
    buildStudentIdentityGuidance() +
    buildClassicExpressionUsageGuidance(options)

  const responseText = await generateText(config, promptText)
  return parseArrayWithFallback<PolishedCommentResult>(responseText, [], 'polishBatchComments')
}

/**
 * 从图片中识别学生成绩
 * @param imageBase64 - 图片 base64 数据
 * @param prompt - 提示词
 * @param config - AI 服务配置
 * @returns 识别出的学生成绩列表
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
 * @param category - 标签分类
 * @param count - 生成数量
 * @param requirement - 附加要求
 * @param prompt - 提示词模板
 * @param config - AI 服务配置
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

  const responseText = await generateText(config, promptText)
  return parseArrayWithFallback<string>(responseText, [], 'generateTags')
}

/**
 * AI 生成学生标签分类
 * @param count - 生成数量
 * @param requirement - 附加要求
 * @param prompt - 提示词模板
 * @param config - AI 服务配置
 * @returns 生成的分类数组
 */
export async function generateTagCategories(
  count: number,
  requirement: string,
  prompt: string,
  config: AIServiceConfig
): Promise<string[]> {
  const promptText = replaceTemplate(prompt, {
    count,
    requirement: requirement || '无特殊要求'
  })

  const responseText = await generateText(config, promptText)
  return parseArrayWithFallback<string>(responseText, [], 'generateTagCategories')
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

/**
 * 从图片中识别错题题目
 * @param imageBase64 - 图片 base64 数据
 * @param config - AI 服务配置
 * @returns 识别出的题目信息
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
 * @param questionText - 题目内容
 * @param questionImages - 题目图片 base64 数据数组
 * @param config - AI 服务配置
 * @returns 生成的答案与解析
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
