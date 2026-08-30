import type {
  DashboardUnitDifficultyShiftType,
  DashboardUnitOverviewType,
  DashboardVolatilityDirectionType,
  DashboardStudentTagType,
  HomeDashboardConfigType
} from '@/types/HomeDashboard'
import type { SettingType } from '@/types/Setting'
import type { StudentDataType } from '@/types/StudentData'

/** 构建总览页数据的入参 */
export interface BuildOverviewDashboardDataOptions {
  /** 学生数据列表 */
  students: StudentDataType[]
  /** 启用的单元表头（即单元列表） */
  unitHeaders: SettingType[]
  /** 趋势分析中选中的学生 ID 列表 */
  selectedStudentIds: string[]
  /** 是否已配置 AI，用于评语概览的提示 */
  aiConfigured: boolean
  /** 班级总览页配置 */
  config: HomeDashboardConfigType
}

/** 单个学生在单个单元上的成绩点（含排名与难度偏移） */
export interface StudentPointType {
  /** 单元字段名（对应表头 prop） */
  prop: string
  /** 单元显示名称 */
  label: string
  /** 成绩分数 */
  score: number
  /** 班级排名，未录入时为 null */
  rank: number | null
  /** 该单元相对近期的难度偏移（偏易/偏难/正常） */
  difficultyShift: DashboardUnitDifficultyShiftType
}

/** 单元维度的汇总统计（扩展自 DashboardUnitOverviewType） */
export interface UnitMetricType extends DashboardUnitOverviewType {
  /** 该单元所有有效分数 */
  scores: number[]
  /** 低于及格线的人数 */
  lowScoreCount: number
  /** 成绩标准差，用于衡量学生分化程度 */
  standardDeviation: number
}

/** 学生维度的画像与统计结果，供标签命中、推荐与趋势分析使用 */
export interface StudentMetricType {
  /** 学生 ID */
  studentId: string
  /** 学生姓名 */
  name: string
  /** 原始学生数据 */
  student: StudentDataType
  /** 成绩序列（按单元顺序） */
  points: StudentPointType[]
  /** 全部已录入单元的成绩均分 */
  averageScore: number
  /** 最新一次成绩 */
  latestScore: number | null
  /** 上一次成绩 */
  previousScore: number | null
  /** 历史均分（不含最新一次成绩），无历史成绩时为 null */
  historyAverage: number | null
  /** 最新成绩相对历史均分的差值，正数表示高于平均 */
  latestDelta: number
  /** 最新成绩相对上一单元成绩的下降幅度 */
  latestDrop: number
  /** 成绩极差（最高分 - 最低分），用于衡量波动 */
  scoreRange: number
  /** 低于及格线的成绩次数 */
  lowScoreCount: number
  /** 最近窗口内进入班级前列的次数 */
  stableTopRecentCount: number
  /** 最近 4 次成绩（原始分数，用于展示） */
  recentScores: number[]
  /** 最近 3 次成绩（原始分数） */
  recentThreeScores: number[]
  /** 波动窗口内成绩（原始分数，窗口由波动标签配置决定） */
  recentFourScores: number[]
  /** 最近 4 次归一化成绩的均分 */
  recentAverage: number | null
  /** 最近窗口内归一化成绩的标准差 */
  recentStdDev: number
  /** 走势方向（上行/下行/波动上行/波动下行） */
  volatilityDirection: DashboardVolatilityDirectionType | null
  /** 命中的标签列表（已归一化并按优先级排序） */
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
  /** 当前总体走势是否更接近上行 */
  isUpwardDirection: boolean
  /** 当前总体走势是否更接近下行 */
  isDownwardDirection: boolean
  /** 最近一次动量是否向上（较上一次成绩提升） */
  latestMomentumUp: boolean
  /** 最近一次动量是否向下（较上一次成绩下降） */
  latestMomentumDown: boolean
  /** 最近 3 次是否严格单调递增 */
  recentAscending: boolean
  /** 最近 3 次是否严格单调递减 */
  recentDescending: boolean
  /** 最近 3 次的累计涨跌（末次减首次） */
  recentDelta: number
  /** 最近 3 次的累计上升幅度（负值归零） */
  risingDelta: number
  /** 最近 3 次的累计下降幅度（负值归零） */
  fallingDelta: number
  /** 最新成绩是否显著高于近期均值 */
  latestAboveAverage: boolean
  /** 最新成绩是否显著低于近期均值 */
  latestBelowAverage: boolean
  /** 是否连续下降且累计跌幅达到阈值 */
  hasSignificantContinuousDecline: boolean
  /** 最近一次是否出现单次显著下滑 */
  hasSignificantSingleDrop: boolean
  /** 近期整体趋势是否明显下降 */
  trendDecline: boolean
  /** 当前是否仍属于中段画像 */
  recentMiddleProfile: boolean
  /** 前期历史成绩是否出现过持续低分 */
  hadEarlierLowPattern: boolean
  /** 最近一次是否仍在继续回升 */
  latestRising: boolean
  /** 当前分数是否仍处于低位修复区 */
  lowRecoveryScoreEligible: boolean
}
