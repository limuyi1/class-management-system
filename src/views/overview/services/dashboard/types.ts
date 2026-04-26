import type {
  DashboardUnitDifficultyShiftType,
  DashboardUnitOverviewType,
  DashboardVolatilityDirectionType,
  DashboardStudentTagType,
  HomeDashboardConfigType
} from '@/types/HomeDashboard'
import type { SettingType } from '@/types/Setting'
import type { StudentDataType } from '@/types/StudentData'

export interface BuildOverviewDashboardDataOptions {
  students: StudentDataType[]
  unitHeaders: SettingType[]
  selectedStudentNames: string[]
  aiConfigured: boolean
  config: HomeDashboardConfigType
}

export interface StudentPointType {
  prop: string
  label: string
  score: number
  rank: number | null
  difficultyShift: DashboardUnitDifficultyShiftType
}

export interface UnitMetricType extends DashboardUnitOverviewType {
  scores: number[]
  lowScoreCount: number
  standardDeviation: number
}

export interface StudentMetricType {
  name: string
  student: StudentDataType
  points: StudentPointType[]
  averageScore: number
  latestScore: number | null
  previousScore: number | null
  historyAverage: number | null
  latestDelta: number
  latestDrop: number
  scoreRange: number
  lowScoreCount: number
  stableTopRecentCount: number
  recentScores: number[]
  recentThreeScores: number[]
  recentFourScores: number[]
  recentAverage: number | null
  recentStdDev: number
  volatilityDirection: DashboardVolatilityDirectionType | null
  matchedTags: DashboardStudentTagType[]
}

/**
 * 学生趋势信号层。
 *
 * 这层不直接产生标签，只负责把“当前发生了什么”标准化成一组可复用信号，
 * 供下游标签命中和归一化统一消费。
 *
 * 设计目标：
 * - 避免每个标签各自重复计算趋势条件
 * - 保证方向、区间、低位修复、持续进退步等概念使用同一套基础判断
 * - 让后续维护时能先看信号，再看标签组合，降低规则冲突排查成本
 */
export interface StudentSignalSnapshotType {
  isUpwardDirection: boolean
  isDownwardDirection: boolean
  latestMomentumUp: boolean
  latestMomentumDown: boolean
  recentAscending: boolean
  recentDescending: boolean
  recentDelta: number
  risingDelta: number
  fallingDelta: number
  latestAboveAverage: boolean
  latestBelowAverage: boolean
  hasSignificantContinuousDecline: boolean
  hasSignificantSingleDrop: boolean
  trendDecline: boolean
  recentMiddleProfile: boolean
  hadEarlierLowPattern: boolean
  latestRising: boolean
  lowRecoveryScoreEligible: boolean
}
