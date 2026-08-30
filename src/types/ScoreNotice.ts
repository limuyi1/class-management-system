/** 成绩通知单模块的类型定义 */

/** 成绩通知单模式：等级制 / 分数制 */
export enum ScoreNoticeModeEnum {
  /** 等级制（按 A/B 等展示） */
  Grade = 'grade',
  /** 分数制（展示原始分数） */
  Score = 'score'
}

/** 成绩通知单评语状态 */
export enum ScoreNoticeCommentStatusEnum {
  /** 待生成 */
  Pending = 'pending',
  /** 生成中 */
  Generating = 'generating',
  /** 已生成 */
  Generated = 'generated',
  /** 手动填写 */
  Manual = 'manual',
  /** 需人工复核 */
  NeedsReview = 'needs-review',
  /** 生成失败 */
  Failed = 'failed',
  /** 缺少评语 */
  Missing = 'missing'
}

/** 等级规则：根据最高分和各等级分数线划定 A/B 等 */
export interface ScoreNoticeGradeRuleType {
  /** 最高分 */
  maxScore: number
  /** A 等最低分 */
  gradeAMin: number
  /** B 等最低分 */
  gradeBMin: number
}

/** 成绩通知单中的科目配置 */
export interface ScoreNoticeSubjectType {
  /** 科目唯一标识 */
  id: string
  /** 科目显示名称 */
  label: string
  /** 对应的源数据列 */
  sourceColumn: string
  /** 等级规则 */
  rule: ScoreNoticeGradeRuleType
}

/** 成绩通知单中的学生条目 */
export interface ScoreNoticeStudentType {
  /** 学生唯一标识 */
  id: string
  /** 源数据中的学生 ID（可选） */
  sourceStudentId?: string
  /** 学生姓名 */
  name: string
  /** 各科原始分数，key 为科目 ID */
  rawValues: Record<string, string | number | null>
  /** 各科等级值，key 为科目 ID */
  gradeValues: Record<string, string | null>
  /** 评语正文 */
  comment: string
  /** 评语状态 */
  commentStatus: ScoreNoticeCommentStatusEnum
  /** 生成失败的错误信息 */
  errorMessage?: string
  /** 校验不通过的原因列表 */
  validationReasons?: string[]
}

/** 成绩通知单 Store 状态 */
export interface ScoreNoticeStateType {
  /** 通知单标题 */
  title: string
  /** 通知单日期 */
  noticeDate: string
  /** 展示模式（等级制 / 分数制） */
  mode: ScoreNoticeModeEnum
  /** 数据来源模式 */
  sourceMode: ScoreNoticeModeEnum
  /** 来源文件名 */
  sourceFileName: string
  /** 科目配置列表 */
  subjects: ScoreNoticeSubjectType[]
  /** 学生条目列表 */
  students: ScoreNoticeStudentType[]
  /** 当前选中的学生 ID */
  selectedStudentId: string
  /** 更新时间（ISO 格式） */
  updatedAt?: string
}

/** 成绩通知单导入结果 */
export interface ScoreNoticeImportResultType {
  /** 数据来源模式 */
  sourceMode: ScoreNoticeModeEnum
  /** 解析出的科目配置列表 */
  subjects: ScoreNoticeSubjectType[]
  /** 解析出的学生条目列表 */
  students: ScoreNoticeStudentType[]
  /** 无效单元格数量 */
  invalidCellCount: number
  /** 重名学生列表 */
  duplicateNames: string[]
}
