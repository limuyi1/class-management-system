import type { SettingType } from '@/types/Setting'

export interface DashboardScoreBandType {
  /** 分数段显示名称 */
  label: string
  /** 分数段最小值，包含边界 */
  min: number
  /** 分数段最大值，包含边界 */
  max: number
  /** 分数段对应图表颜色 */
  color: string
}

export interface HomeDashboardAlertConfigType {
  /** 低分线，用于持续低分预警和个人摘要 */
  lowScoreLine: number
  /** 持续低分至少出现多少个单元，才进入预警名单 */
  persistentLowScoreMinCount: number
  /** 波动预警至少要求有多少个单元成绩 */
  maxFluctuationMinUnits: number
  /** 最高分与最低分相差达到多少分，才进入波动预警 */
  maxFluctuationMinRange: number
  /** 最近一次成绩相对历史均分下降多少分，才进入下滑关注 */
  declineMinDrop: number
  /** 重点学生预警每类默认展示的人数 */
  displayCount: number
  /** 首屏紧凑模式下每类预览的人数 */
  compactDisplayCount: number
  /** 重点学生预警每类展开后最多展示的人数 */
  expandedDisplayCount: number
}

export interface HomeDashboardRankingConfigType {
  /** 榜单默认展示人数 */
  displayCount: number
  /** 首屏紧凑模式下每类预览的人数 */
  compactDisplayCount: number
  /** 统计“稳定前五”时使用的排名阈值 */
  stableTopRankLimit: number
  /** 参与阶段趋势判断至少需要多少个单元成绩 */
  minUnitsForTrend: number
}

export interface HomeDashboardStudentTrendConfigType {
  /** 个人趋势摘要里的低分判定线 */
  lowScoreLine: number
  /** 最高分与最低分超过该值时，摘要提示“波动较大” */
  highFluctuationRange: number
  /** 最近成绩高于历史均分多少分，提示“回升明显” */
  significantRise: number
  /** 最近成绩低于历史均分多少分，提示“下降明显” */
  significantDrop: number
  /** 个人趋势卡中最多展示多少条摘要 */
  summaryLimit: number
  /** 学生趋势卡最多允许同时对比的人数 */
  maxCompareCount: number
}

export interface HomeDashboardConfigType {
  unitOverview: {
    /** 单元总览图中展示的分数段配置 */
    scoreBands: DashboardScoreBandType[]
    /** 单元数量超过该值时，单元总览图才显示横向滚动条 */
    dataZoomThreshold: number
    /** 横向滚动开启后，默认可见的单元数量 */
    dataZoomVisibleCount: number
  }
  /** 重点学生预警相关阈值 */
  alerts: HomeDashboardAlertConfigType
  /** 学生掌握情况榜单相关阈值 */
  rankings: HomeDashboardRankingConfigType
  /** 学生个人趋势卡摘要规则 */
  studentTrend: HomeDashboardStudentTrendConfigType
}

export interface DashboardUnitOverviewType {
  prop: string
  label: string
  averageScore: number
  validCount: number
  scoreBands: Array<DashboardScoreBandType & { count: number }>
}

export interface DashboardStudentOptionType {
  label: string
  value: string
}

export interface DashboardStudentListItemType {
  name: string
  subtitle: string
  badge: string
}

export interface DashboardAlertGroupType {
  key: 'persistentLowScore' | 'largestFluctuation' | 'declining'
  label: string
  items: DashboardStudentListItemType[]
}

export interface DashboardRankingGroupType {
  key: 'mostImproved' | 'stableTopFive'
  label: string
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

export interface DashboardDataType {
  unitHeaders: SettingType[]
  unitOverview: DashboardUnitOverviewType[]
  alertGroups: DashboardAlertGroupType[]
  rankingGroups: DashboardRankingGroupType[]
  studentOptions: DashboardStudentOptionType[]
  quickStudentNames: string[]
  studentTrend: DashboardStudentTrendType | null
  evaluationOverview: DashboardEvaluationOverviewType
}
