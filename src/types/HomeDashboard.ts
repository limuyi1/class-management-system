import type { SettingType } from '@/types/Setting'

/** 仪表盘关注分组标识 */
export type DashboardFocusGroupKeyType =
  | 'attention'
  | 'encouragement'
  | 'middleChange'
  | 'volatilityWatch'

/** 仪表盘学生标签标识 */
export type DashboardTagKeyType =
  | 'critical'
  | 'persistentLowScore'
  | 'declining'
  | 'abnormal'
  | 'volatility'
  | 'improving'
  | 'lowRecovery'
  | 'stableTop'
  | 'middleRising'
  | 'middleFalling'

/** 仪表盘关注分段标识（扩展波动方向子类） */
export type DashboardFocusSectionKeyType =
  | DashboardTagKeyType
  | 'volatilityRising'
  | 'volatilityFalling'

/** 波动方向 */
export type DashboardVolatilityDirectionType = 'up' | 'down' | 'volatileUp' | 'volatileDown'
/** 单元难度变化方向 */
export type DashboardUnitDifficultyShiftType = 'easy' | 'hard' | 'normal'
/** 概览仪表盘阶段 */
export type OverviewDashboardStageType = 'noUnits' | 'noScores' | 'ready'

/** 分数段配置 */
export interface DashboardScoreBandType {
  label: string
  min: number
  max: number
  color: string
}

/** 标签分组配置 */
export interface HomeDashboardTagGroupConfigType {
  label: string
  tone: 'danger' | 'warning' | 'success' | 'info'
}

/** 标签规则配置（定义触发条件和阈值） */
export interface HomeDashboardTagRuleConfigType {
  label: string
  enabled: boolean
  group: DashboardFocusGroupKeyType
  priority: number
  recentWindow: number
  description: string
  minScore?: number
  maxScore?: number
  minHitCount?: number
  minDelta?: number
  minCumulativeDrop?: number
  minSingleDrop?: number
  abnormalDrop?: number
  stdDevThreshold?: number
  minTopRankHits?: number
  topRankLimit?: number
  minValidScores?: number
}

/** 仪表盘标签配置 */
export interface HomeDashboardTagConfigType {
  passLine: number
  middleScoreMin: number
  middleScoreMax: number
  latestUnitDifficultyShiftThreshold: number
  unitDifficultyBaselineWindow: number
  easyUnitAverageScore: number
  hardUnitAverageScore: number
  tagGroups: Record<DashboardFocusGroupKeyType, HomeDashboardTagGroupConfigType>
  tags: Record<DashboardTagKeyType, HomeDashboardTagRuleConfigType>
}

/** 学生趋势图配置 */
export interface HomeDashboardStudentTrendConfigType {
  lowScoreLine: number
  highFluctuationRange: number
  significantRise: number
  significantDrop: number
  summaryLimit: number
  maxCompareCount: number
}

/** 推荐权重配置 */
export interface HomeDashboardRecommendationWeightType {
  abnormalDrop?: number
  lowScoreHit?: number
  declineDelta?: number
  multiTagBonus?: number
  riseDelta?: number
  recoveryBonus?: number
  stableTopBonus?: number
  fallingDelta?: number
  volatility?: number
  risingDelta?: number
}

/** 仪表盘完整配置 */
export interface HomeDashboardConfigType {
  unitOverview: {
    scoreBands: DashboardScoreBandType[]
    dataZoomThreshold: number
    dataZoomVisibleCount: number
  }
  tagRules: HomeDashboardTagConfigType
  studentTrend: HomeDashboardStudentTrendConfigType
  recommendation: {
    maxItemsPerGroup: number
    attentionWeights: HomeDashboardRecommendationWeightType
    encouragementWeights: HomeDashboardRecommendationWeightType
    middleChangeWeights: HomeDashboardRecommendationWeightType
  }
}

/** 单元概览数据 */
export interface DashboardUnitOverviewType {
  prop: string
  label: string
  averageScore: number
  validCount: number
  scoreBands: Array<DashboardScoreBandType & { count: number }>
}

/** 教学洞察项 */
export interface DashboardTeachingInsightType {
  key: 'lowestAverage' | 'mostLowScores' | 'largestGap' | 'mostVolatile'
  label: string
  value: string
}

/** 学生选项 */
export interface DashboardStudentOptionType {
  label: string
  value: string
}

/** 快捷学生入口 */
export interface DashboardQuickStudentType {
  studentId: string
  name: string
}

/** 学生标签 */
export interface DashboardStudentTagType {
  key: DashboardTagKeyType
  label: string
  priority: number
  group: DashboardFocusGroupKeyType
  tone: 'danger' | 'warning' | 'success' | 'info'
  description: string
}

/** 关注学生列表项 */
export interface DashboardStudentListItemType {
  studentId: string
  name: string
  trendText: string
  trendSegments: Array<{
    text: string
    difficultyShift: DashboardUnitDifficultyShiftType
  }>
  subtitle: string
  badge: string
  reasonText: string
  volatilityDirection?: DashboardVolatilityDirectionType
  primaryTag: DashboardStudentTagType
  secondaryTags: DashboardStudentTagType[]
}

/** 关注分段（如"临界关注""持续低分"等） */
export interface DashboardFocusSectionType {
  key: DashboardFocusSectionKeyType
  label: string
  description: string
  priority: number
  count: number
  items: DashboardStudentListItemType[]
}

/** 关注分组（关注 / 鼓励 / 中段波动 / 波动预警） */
export interface DashboardFocusGroupType {
  key: DashboardFocusGroupKeyType
  label: string
  tone: 'danger' | 'warning' | 'success' | 'info'
  sections: DashboardFocusSectionType[]
}

/** 概览卡片 */
export interface DashboardSummaryCardType {
  key: DashboardFocusGroupKeyType | 'overview'
  label: string
  value: number | string
  unit?: string
  icon: string
  layout: 'quad' | 'double' | 'triple' | 'overview'
  tone: 'danger' | 'warning' | 'success' | 'info'
  summary: string
  details: Array<{ label: string; value: number | string }>
}

/** 关键学生列表 */
export interface DashboardKeyStudentListType {
  key: DashboardFocusGroupKeyType
  label: string
  items: DashboardStudentListItemType[]
}

/** 学生趋势数据点 */
export interface DashboardStudentTrendPointType {
  label: string
  score: number | null
}

/** 学生趋势数据（单生或对比） */
export interface DashboardStudentTrendStudentType {
  studentId: string
  name: string
  scoreCount: number
  completedComment: boolean
  commentPreview: string
  tags: DashboardStudentTagType[]
  trendPoints: DashboardStudentTrendPointType[]
}

/** 学生趋势面板数据 */
export interface DashboardStudentTrendType {
  mode: 'single' | 'compare'
  students: DashboardStudentTrendStudentType[]
  summaries: string[]
  classAverageScore?: number
}

/** 评语概览 */
export interface DashboardEvaluationOverviewType {
  totalCount: number
  completedCount: number
  pendingCount: number
  completionRate: number
  aiConfigured: boolean
}

/** KPI 指标 */
export interface DashboardKpiType {
  averageScore: number
  averagePassRate: number
  passRateFluctuation: number
  attentionStudentCount: number
  completedUnitCount: number
  totalUnitCount: number
  biggestFluctuationUnitLabel: string
  diagnosticText: string
}

/** 仪表盘完整数据 */
export interface DashboardDataType {
  unitHeaders: SettingType[]
  unitOverview: DashboardUnitOverviewType[]
  teachingInsights: DashboardTeachingInsightType[]
  kpi: DashboardKpiType
  summaryCards: DashboardSummaryCardType[]
  focusGroups: DashboardFocusGroupType[]
  keyStudentLists: DashboardKeyStudentListType[]
  studentOptions: DashboardStudentOptionType[]
  quickStudents: DashboardQuickStudentType[]
  studentTrend: DashboardStudentTrendType | null
  evaluationOverview: DashboardEvaluationOverviewType
}
