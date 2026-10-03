/** AI 服务兼容入口；具体业务实现按场景拆分，保持原有调用接口。 */
export { testAIConnection, fetchAvailableModels } from '@/ai/modelService'
export {
  generateSingleComment,
  polishSingleComment,
  generateBatchComments,
  polishBatchComments
} from '@/ai/commentService'
export {
  generateScoreNoticeComment,
  generateScoreNoticeComments
} from '@/ai/scoreNoticeCommentService'
export { generateStudentReportSummary, generateLearningAnalysis } from '@/ai/reportService'
export { generateTags, generateTagCategories } from '@/ai/tagService'
export { recognizeScoreFromImage } from '@/ai/scoreRecognitionService'
export { recognizeQuestionFromImage, generateAnswerFromQuestion } from '@/ai/questionService'
export type { ScoreNoticeCommentInputType, ScoreNoticeCommentResultType } from '@/types/AIService'
