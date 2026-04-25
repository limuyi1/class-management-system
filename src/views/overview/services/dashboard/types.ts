import type {
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
