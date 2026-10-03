/** AI 业务服务的请求、选项与返回结果类型。 */

/**
 * AI 服务模块
 * 提供与各种 AI 模型（Gemini、OpenAI 兼容 API）交互的接口
 * 支持生成评语、识别图片成绩、生成标签等功能
 */

/** 传递给 AI 的学生数据 */
export interface AIStudentDataType {
  studentId?: string
  name: string
  tags?: string | string[]
  score?: number | Array<{ label: string; value: number | null }>
  comment?: string | null
}

/** 经典表达使用情况 */
export interface ClassicExpressionUsageType {
  expression: string
  count: number
}

/** 批量评语生成的附加选项 */
export interface BatchCommentOptionsType {
  classicExpressionUsages?: ClassicExpressionUsageType[]
  maxClassicExpressionUsage?: number
}

/** 批量评语生成结果 */
export interface BatchCommentResultType extends AIStudentDataType {
  classicExpression?: string
}

/** 批量润色结果 */
export interface PolishedCommentResultType {
  studentId: string
  name: string
  comment: string
  classicExpression?: string
}

/** 图片识别的学生成绩结果 */
export interface ScoreRecognitionResultType {
  name: string
  rawName: string | null
  matchedName?: string | null
  score: number | null
}

/** 模型返回的新旧两种成绩识别结构 */
export interface VisionScoreResultType {
  name?: unknown
  rawName?: unknown
  matchedName?: unknown
  score?: unknown
}

/** 图片识别的题目结果 */
export interface QuestionRecognitionResultType {
  question: string
  answer: string
  explanation?: string
  questionType?: string
  hasImage: boolean
}

/** 题目答案与解析生成结果 */
export interface AnswerGenerateResultType {
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
