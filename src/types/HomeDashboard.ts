import type { SettingType } from '@/types/Setting'

export type DashboardFocusGroupKeyType =
  | 'attention'
  | 'encouragement'
  | 'middleChange'
  | 'volatilityWatch'

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

export type DashboardFocusSectionKeyType =
  | DashboardTagKeyType
  | 'volatilityRising'
  | 'volatilityFalling'

export type DashboardVolatilityDirectionType = 'up' | 'down'

export interface DashboardScoreBandType {
  label: string
  min: number
  max: number
  color: string
}

export interface HomeDashboardTagGroupConfigType {
  label: string
  tone: 'danger' | 'warning' | 'success' | 'info'
}

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
  abnormalDrop?: number
  stdDevThreshold?: number
  minTopRankHits?: number
  topRankLimit?: number
  minValidScores?: number
}

export interface HomeDashboardTagConfigType {
  passLine: number
  middleScoreMin: number
  middleScoreMax: number
  tagGroups: Record<DashboardFocusGroupKeyType, HomeDashboardTagGroupConfigType>
  tags: Record<DashboardTagKeyType, HomeDashboardTagRuleConfigType>
}

export interface HomeDashboardStudentTrendConfigType {
  lowScoreLine: number
  highFluctuationRange: number
  significantRise: number
  significantDrop: number
  summaryLimit: number
  maxCompareCount: number
}

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

export interface DashboardUnitOverviewType {
  prop: string
  label: string
  averageScore: number
  validCount: number
  scoreBands: Array<DashboardScoreBandType & { count: number }>
}

export interface DashboardTeachingInsightType {
  key: 'lowestAverage' | 'mostLowScores' | 'largestGap' | 'mostVolatile'
  label: string
  value: string
}

export interface DashboardStudentOptionType {
  label: string
  value: string
}

export interface DashboardStudentTagType {
  key: DashboardTagKeyType
  label: string
  priority: number
  group: DashboardFocusGroupKeyType
  tone: 'danger' | 'warning' | 'success' | 'info'
  description: string
}

export interface DashboardStudentListItemType {
  name: string
  trendText: string
  subtitle: string
  badge: string
  reasonText: string
  volatilityDirection?: DashboardVolatilityDirectionType
  primaryTag: DashboardStudentTagType
  secondaryTags: DashboardStudentTagType[]
}

export interface DashboardFocusSectionType {
  key: DashboardFocusSectionKeyType
  label: string
  description: string
  count: number
  items: DashboardStudentListItemType[]
}

export interface DashboardFocusGroupType {
  key: DashboardFocusGroupKeyType
  label: string
  tone: 'danger' | 'warning' | 'success' | 'info'
  sections: DashboardFocusSectionType[]
}

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

export interface DashboardKeyStudentListType {
  key: DashboardFocusGroupKeyType
  label: string
  description: string
  items: DashboardStudentListItemType[]
}

export interface DashboardStudentTrendPointType {
  label: string
  score: number
}

export interface DashboardStudentTrendStudentType {
  name: string
  scoreCount: number
  completedComment: boolean
  commentPreview: string
  tags: DashboardStudentTagType[]
  trendPoints: DashboardStudentTrendPointType[]
}

export interface DashboardStudentTrendType {
  mode: 'single' | 'compare'
  students: DashboardStudentTrendStudentType[]
  summaries: string[]
}

export interface DashboardEvaluationOverviewType {
  totalCount: number
  completedCount: number
  pendingCount: number
  completionRate: number
  aiConfigured: boolean
}

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

export interface DashboardDataType {
  unitHeaders: SettingType[]
  unitOverview: DashboardUnitOverviewType[]
  teachingInsights: DashboardTeachingInsightType[]
  kpi: DashboardKpiType
  summaryCards: DashboardSummaryCardType[]
  focusGroups: DashboardFocusGroupType[]
  keyStudentLists: DashboardKeyStudentListType[]
  studentOptions: DashboardStudentOptionType[]
  quickStudentNames: string[]
  studentTrend: DashboardStudentTrendType | null
  evaluationOverview: DashboardEvaluationOverviewType
}
