/** 学习报告模型与图片导出类型。 */

/** 通用操作结果：success 标识是否成功，失败时携带 error */
export interface OperationResultType {
  success: boolean
  error?: Error
}

/** 学生报告中的单科成绩项 */
export interface StudentReportScoreItemType {
  prop: string
  label: string
  score: number | null
  average: number | null
  rank: number | null
  delta: number | null
}

/** 成绩、均分、名次均已有效的成绩项 */
export type StudentReportValidScoreItemType = Omit<
  StudentReportScoreItemType,
  'score' | 'average' | 'rank'
> & {
  score: number
  average: number
  rank: number
}

/** 报告概览统计卡片 */
export interface StudentReportSummaryStatType {
  label: string
  value: string
  hint: string
  tone: 'teal' | 'blue' | 'orange' | 'purple'
  icon: string
}

/** 学生报告汇总信息 */
export interface StudentReportSummaryType {
  averageScore: number
  highestScore: number
  lowestScore: number
  progressCount: number
  trendLabel: string
  totalDelta: number
  bestScore: StudentReportValidScoreItemType | null
  worstScore: StudentReportValidScoreItemType | null
  bestRank: StudentReportValidScoreItemType | null
  worstRank: StudentReportValidScoreItemType | null
  statCards: StudentReportSummaryStatType[]
}

/** 学生报告洞察分组（标题 + 条目列表） */
export interface StudentReportInsightType {
  title: string
  items: string[]
}

/** 学生报告的完整展示模型 */
export interface StudentReportDataType {
  studentName: string
  classLabel: string
  studentCount: number
  classAverageScore: number
  generatedAtText: string
  headline: string
  overviewLead: string
  scoreItems: StudentReportScoreItemType[]
  summary: StudentReportSummaryType
  tags: string[]
  strengths: string[]
  concerns: string[]
  insights: StudentReportInsightType[]
}

/** 报告图片导出选项 */
export interface StudentReportExportOptionsType {
  scale?: number
  backgroundColor?: string
}
