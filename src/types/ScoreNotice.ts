export enum ScoreNoticeModeEnum {
  Grade = 'grade',
  Score = 'score'
}

export enum ScoreNoticeCommentStatusEnum {
  Pending = 'pending',
  Generating = 'generating',
  Generated = 'generated',
  Manual = 'manual',
  NeedsReview = 'needs-review',
  Failed = 'failed',
  Missing = 'missing'
}

export interface ScoreNoticeGradeRuleType {
  maxScore: number
  gradeAMin: number
  gradeBMin: number
}

export interface ScoreNoticeSubjectType {
  id: string
  label: string
  sourceColumn: string
  rule: ScoreNoticeGradeRuleType
}

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

export interface ScoreNoticeImportResultType {
  sourceMode: ScoreNoticeModeEnum
  subjects: ScoreNoticeSubjectType[]
  students: ScoreNoticeStudentType[]
  invalidCellCount: number
  duplicateNames: string[]
}
