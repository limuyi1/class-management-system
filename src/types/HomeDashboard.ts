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
  /** 分数段显示名称 */
  label: string
  /** 分数段下限（含） */
  min: number
  /** 分数段上限（含） */
  max: number
  /** 分数段颜色 */
  color: string
}

/** 标签分组配置 */
export interface HomeDashboardTagGroupConfigType {
  /** 分组显示名称 */
  label: string
  /** 分组色调 */
  tone: 'danger' | 'warning' | 'success' | 'info'
}

/** 标签规则配置（定义触发条件和阈值） */
export interface HomeDashboardTagRuleConfigType {
  /** 标签显示名称 */
  label: string
  /** 是否启用该规则 */
  enabled: boolean
  /** 所属关注分组 */
  group: DashboardFocusGroupKeyType
  /** 标签优先级（数值越小越靠前） */
  priority: number
  /** 近期观察窗口大小（单元数） */
  recentWindow: number
  /** 标签说明 */
  description: string
  /** 分数下限阈值（可选） */
  minScore?: number
  /** 分数上限阈值（可选） */
  maxScore?: number
  /** 最低命中次数（可选） */
  minHitCount?: number
  /** 最小分数变化量（可选） */
  minDelta?: number
  /** 最小累计下滑幅度（可选） */
  minCumulativeDrop?: number
  /** 最小单次下滑幅度（可选） */
  minSingleDrop?: number
  /** 异常下滑阈值（可选） */
  abnormalDrop?: number
  /** 标准差波动阈值（可选） */
  stdDevThreshold?: number
  /** 进入前列的最小次数（可选） */
  minTopRankHits?: number
  /** 前列排名范围（可选） */
  topRankLimit?: number
  /** 最低有效成绩条数（可选） */
  minValidScores?: number
}

/** 仪表盘标签配置 */
export interface HomeDashboardTagConfigType {
  /** 及格线 */
  passLine: number
  /** 中段分数下限 */
  middleScoreMin: number
  /** 中段分数上限 */
  middleScoreMax: number
  /** 最近单元难度变化阈值 */
  latestUnitDifficultyShiftThreshold: number
  /** 单元难度基准观察窗口大小 */
  unitDifficultyBaselineWindow: number
  /** 简单单元平均分基准 */
  easyUnitAverageScore: number
  /** 困难单元平均分基准 */
  hardUnitAverageScore: number
  /** 标签分组配置，key 为关注分组标识 */
  tagGroups: Record<DashboardFocusGroupKeyType, HomeDashboardTagGroupConfigType>
  /** 标签规则配置，key 为标签标识 */
  tags: Record<DashboardTagKeyType, HomeDashboardTagRuleConfigType>
}

/** 学生趋势图配置 */
export interface HomeDashboardStudentTrendConfigType {
  /** 低分警戒线 */
  lowScoreLine: number
  /** 高波动幅度阈值 */
  highFluctuationRange: number
  /** 显著上升阈值 */
  significantRise: number
  /** 显著下降阈值 */
  significantDrop: number
  /** 趋势摘要条数上限 */
  summaryLimit: number
  /** 对比学生数量上限 */
  maxCompareCount: number
}

/** 推荐权重配置 */
export interface HomeDashboardRecommendationWeightType {
  /** 异常下滑权重（可选） */
  abnormalDrop?: number
  /** 低分命中权重（可选） */
  lowScoreHit?: number
  /** 下滑幅度权重（可选） */
  declineDelta?: number
  /** 多标签加成权重（可选） */
  multiTagBonus?: number
  /** 上升幅度权重（可选） */
  riseDelta?: number
  /** 回升加成权重（可选） */
  recoveryBonus?: number
  /** 稳定前列加成权重（可选） */
  stableTopBonus?: number
  /** 回落幅度权重（可选） */
  fallingDelta?: number
  /** 波动权重（可选） */
  volatility?: number
  /** 上升权重（可选） */
  risingDelta?: number
}

/** 仪表盘完整配置 */
export interface HomeDashboardConfigType {
  /** 单元概览配置 */
  unitOverview: {
    /** 分数段配置列表 */
    scoreBands: DashboardScoreBandType[]
    /** 图表数据缩放阈值 */
    dataZoomThreshold: number
    /** 缩放时可见单元数量 */
    dataZoomVisibleCount: number
  }
  /** 标签规则配置 */
  tagRules: HomeDashboardTagConfigType
  /** 学生趋势图配置 */
  studentTrend: HomeDashboardStudentTrendConfigType
  /** 推荐权重配置 */
  recommendation: {
    /** 每个分组最多展示的条目数 */
    maxItemsPerGroup: number
    /** 关注分组权重 */
    attentionWeights: HomeDashboardRecommendationWeightType
    /** 鼓励分组权重 */
    encouragementWeights: HomeDashboardRecommendationWeightType
    /** 中段波动分组权重 */
    middleChangeWeights: HomeDashboardRecommendationWeightType
  }
}

/** 单元概览数据 */
export interface DashboardUnitOverviewType {
  /** 成绩列 prop */
  prop: string
  /** 单元显示名称 */
  label: string
  /** 平均分 */
  averageScore: number
  /** 有效成绩数量 */
  validCount: number
  /** 各分数段人数统计 */
  scoreBands: Array<DashboardScoreBandType & { count: number }>
}

/** 教学洞察项 */
export interface DashboardTeachingInsightType {
  /** 洞察类型标识 */
  key: 'lowestAverage' | 'mostLowScores' | 'largestGap' | 'mostVolatile'
  /** 洞察显示名称 */
  label: string
  /** 洞察描述文本 */
  value: string
}

/** 学生选项 */
export interface DashboardStudentOptionType {
  /** 选项显示名称 */
  label: string
  /** 选项值（学生 ID） */
  value: string
}

/** 快捷学生入口 */
export interface DashboardQuickStudentType {
  /** 学生 ID */
  studentId: string
  /** 学生姓名 */
  name: string
}

/** 学生标签 */
export interface DashboardStudentTagType {
  /** 标签标识 */
  key: DashboardTagKeyType
  /** 标签显示名称 */
  label: string
  /** 标签优先级（数值越小越靠前） */
  priority: number
  /** 所属关注分组 */
  group: DashboardFocusGroupKeyType
  /** 标签色调 */
  tone: 'danger' | 'warning' | 'success' | 'info'
  /** 标签说明 */
  description: string
}

/** 关注学生列表项 */
export interface DashboardStudentListItemType {
  /** 学生 ID */
  studentId: string
  /** 学生姓名 */
  name: string
  /** 趋势描述文本 */
  trendText: string
  /** 趋势分段列表 */
  trendSegments: Array<{
    /** 分段文本 */
    text: string
    /** 该分段的单元难度变化方向 */
    difficultyShift: DashboardUnitDifficultyShiftType
  }>
  /** 副标题 */
  subtitle: string
  /** 徽标文本 */
  badge: string
  /** 关注原因描述 */
  reasonText: string
  /** 波动方向（可选） */
  volatilityDirection?: DashboardVolatilityDirectionType
  /** 主标签 */
  primaryTag: DashboardStudentTagType
  /** 次要标签列表 */
  secondaryTags: DashboardStudentTagType[]
}

/** 关注分段（如"临界关注""持续低分"等） */
export interface DashboardFocusSectionType {
  /** 分段标识 */
  key: DashboardFocusSectionKeyType
  /** 分段显示名称 */
  label: string
  /** 分段说明 */
  description: string
  /** 分段优先级（数值越小越靠前） */
  priority: number
  /** 该分段学生数量 */
  count: number
  /** 该分段学生列表 */
  items: DashboardStudentListItemType[]
}

/** 关注分组（关注 / 鼓励 / 中段波动 / 波动预警） */
export interface DashboardFocusGroupType {
  /** 分组标识 */
  key: DashboardFocusGroupKeyType
  /** 分组显示名称 */
  label: string
  /** 分组色调 */
  tone: 'danger' | 'warning' | 'success' | 'info'
  /** 分组下的关注分段列表 */
  sections: DashboardFocusSectionType[]
}

/** 概览卡片 */
export interface DashboardSummaryCardType {
  /** 卡片标识 */
  key: DashboardFocusGroupKeyType | 'overview'
  /** 卡片显示名称 */
  label: string
  /** 卡片主值 */
  value: number | string
  /** 主值单位（可选） */
  unit?: string
  /** 卡片图标 */
  icon: string
  /** 卡片布局类型 */
  layout: 'quad' | 'double' | 'triple' | 'overview'
  /** 卡片色调 */
  tone: 'danger' | 'warning' | 'success' | 'info'
  /** 卡片摘要 */
  summary: string
  /** 卡片明细列表 */
  details: Array<{ label: string; value: number | string }>
}

/** 关键学生列表 */
export interface DashboardKeyStudentListType {
  /** 分组标识 */
  key: DashboardFocusGroupKeyType
  /** 列表显示名称 */
  label: string
  /** 关键学生列表 */
  items: DashboardStudentListItemType[]
}

/** 学生趋势数据点 */
export interface DashboardStudentTrendPointType {
  /** 数据点标签（如单元名称） */
  label: string
  /** 分数（null 表示无成绩） */
  score: number | null
}

/** 学生趋势数据（单生或对比） */
export interface DashboardStudentTrendStudentType {
  /** 学生 ID */
  studentId: string
  /** 学生姓名 */
  name: string
  /** 有成绩的单元数量 */
  scoreCount: number
  /** 是否已完成评语 */
  completedComment: boolean
  /** 评语预览文本 */
  commentPreview: string
  /** 学生标签列表 */
  tags: DashboardStudentTagType[]
  /** 趋势数据点列表 */
  trendPoints: DashboardStudentTrendPointType[]
}

/** 学生趋势面板数据 */
export interface DashboardStudentTrendType {
  /** 趋势模式：单人 / 对比 */
  mode: 'single' | 'compare'
  /** 趋势学生列表 */
  students: DashboardStudentTrendStudentType[]
  /** 趋势摘要列表 */
  summaries: string[]
  /** 班级平均分（可选） */
  classAverageScore?: number
}

/** 评语概览 */
export interface DashboardEvaluationOverviewType {
  /** 学生总数 */
  totalCount: number
  /** 已完成评语数 */
  completedCount: number
  /** 待完成评语数 */
  pendingCount: number
  /** 完成率（0-1） */
  completionRate: number
  /** 是否已配置 AI */
  aiConfigured: boolean
}

/** KPI 指标 */
export interface DashboardKpiType {
  /** 平均分 */
  averageScore: number
  /** 平均及格率 */
  averagePassRate: number
  /** 及格率波动幅度 */
  passRateFluctuation: number
  /** 关注学生数量 */
  attentionStudentCount: number
  /** 已完成成绩录入的单元数 */
  completedUnitCount: number
  /** 单元总数 */
  totalUnitCount: number
  /** 波动最大单元名称 */
  biggestFluctuationUnitLabel: string
  /** 诊断描述文本 */
  diagnosticText: string
}

/** 仪表盘完整数据 */
export interface DashboardDataType {
  /** 单元表头列表 */
  unitHeaders: SettingType[]
  /** 单元概览数据列表 */
  unitOverview: DashboardUnitOverviewType[]
  /** 教学洞察列表 */
  teachingInsights: DashboardTeachingInsightType[]
  /** KPI 指标 */
  kpi: DashboardKpiType
  /** 概览卡片列表 */
  summaryCards: DashboardSummaryCardType[]
  /** 关注分组列表 */
  focusGroups: DashboardFocusGroupType[]
  /** 关键学生列表集合 */
  keyStudentLists: DashboardKeyStudentListType[]
  /** 学生选项列表 */
  studentOptions: DashboardStudentOptionType[]
  /** 快捷学生入口列表 */
  quickStudents: DashboardQuickStudentType[]
  /** 学生趋势面板数据（null 表示暂无） */
  studentTrend: DashboardStudentTrendType | null
  /** 评语概览 */
  evaluationOverview: DashboardEvaluationOverviewType
}
