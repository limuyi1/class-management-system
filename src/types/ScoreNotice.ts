/** 成绩通知单模式：等级制 / 分数制 */
export enum ScoreNoticeModeEnum {
  Grade = 'grade',
  Score = 'score'
}

/** 成绩通知单评语状态 */
export enum ScoreNoticeCommentStatusEnum {
  Pending = 'pending',
  Generating = 'generating',
  Generated = 'generated',
  Manual = 'manual',
  NeedsReview = 'needs-review',
  Failed = 'failed',
  Missing = 'missing'
}

/** 等级规则：根据最高分和各等级分数线划定 A/B 等 */
export interface ScoreNoticeGradeRuleType {
  maxScore: number
  gradeAMin: number
  gradeBMin: number
}

/** 成绩通知单中的科目配置 */
export interface ScoreNoticeSubjectType {
  id: string
  label: string
  sourceColumn: string
  rule: ScoreNoticeGradeRuleType
}

/** 成绩通知单中的学生条目 */
export interface ScoreNoticeStudentType {
  id: string
  sourceStudentId?: string
  name: string
  rawValues: Record<string, string | number | null>
  gradeValues: Record<string, string | null>
  comment: string
  commentStatus: ScoreNoticeCommentStatusEnum
  errorMessage?: string
  validationReasons?: string[]
}

/** 成绩通知单 Store 状态 */
export interface ScoreNoticeStateType {
  title: string
  noticeDate: string
  mode: ScoreNoticeModeEnum
  sourceMode: ScoreNoticeModeEnum
  sourceFileName: string
  subjects: ScoreNoticeSubjectType[]
  students: ScoreNoticeStudentType[]
  selectedStudentId: string
  updatedAt?: string
}

/** 成绩通知单导入结果 */
export interface ScoreNoticeImportResultType {
  sourceMode: ScoreNoticeModeEnum
  subjects: ScoreNoticeSubjectType[]
  students: ScoreNoticeStudentType[]
  invalidCellCount: number
  duplicateNames: string[]
}
