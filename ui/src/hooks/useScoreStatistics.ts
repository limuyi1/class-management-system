import { computed, ref, watch } from 'vue'
import type { ComputedRef } from 'vue'

import { NAME_PROP } from '@/constants'
import { getValidScore } from '@/utils/scoreValueUtil'
import type { StudentDataType } from '@/types/StudentData'

/** 分数段统计 */
export interface ScoreRangeType {
  /** 分数段名称（如 90-100分） */
  label: string
  /** 分数段下限 */
  min: number
  /** 分数段上限 */
  max: number
  /** 分数段颜色 */
  color: string
  /** 该分数段人数 */
  count: number
  /** 该分数段学生姓名列表 */
  students: string[]
}

/** 成绩统计结果 */
export interface ScoreStatisticsType {
  /** 最高分 */
  maxScore: number
  /** 获得最高分的人数 */
  maxScoreCount: number
  /** 最高分学生姓名列表 */
  topStudents: string[]
  /** 最低分 */
  minScore: number
  /** 获得最低分的人数 */
  minScoreCount: number
  /** 最低分学生姓名列表 */
  bottomStudents: string[]
  /** 平均分（保留两位小数的字符串） */
  avgScore: string
  /** 常规分数段统计（最高分单列，如 90-98、80-89 等） */
  ranges: ScoreRangeType[]
  /** 低分分数段统计（0-59 分，每 10 分一档） */
  lowScoreRanges: ScoreRangeType[]
  /** 低分学生总数 */
  lowScoreTotal: number
  /** 全部低分学生姓名列表 */
  allLowScoreStudents: string[]
  /** 各分数段中的最大人数（用于图表比例） */
  maxCount: number
  /** 有效成绩总数 */
  totalCount: number
}

/** 成绩统计使用的学生类型（与通用学生数据一致） */
export type ScoreStudentType = StudentDataType

interface UseScoreStatisticsOptions {
  /** 学生列表 */
  students: ComputedRef<StudentDataType[]>
  /** 当前选中的成绩列 prop */
  scoreProp: ComputedRef<string | null>
}

/**
 * 成绩统计分析
 * 根据学生列表和选中的成绩列计算最高分、最低分、平均分、各分数段分布等统计信息
 * @param options - 成绩统计配置（学生列表与当前成绩列）
 * @returns 成绩统计结果及低分阈值相关状态
 */
export function useScoreStatistics(options: UseScoreStatisticsOptions) {
  const { students, scoreProp } = options

  // 低分阈值默认 60 分，支持平均分或自定义两种模式
  const threshold = ref(60)
  /** 低分阈值模式：平均分 / 自定义 */
  const thresholdMode = ref<'average' | 'custom'>('average')

  /** 从学生数据中提取数值型分数 */
  const getScore = (item: StudentDataType): number | null => {
    if (!scoreProp.value) return null
    return getValidScore(item[scoreProp.value])
  }

  /** 获取学生显示名称，缺失时返回「未命名」 */
  const getStudentName = (student: StudentDataType): string => {
    const name = student[NAME_PROP]
    return name === null || name === undefined ? '未命名' : String(name)
  }

  /** 计算成绩统计结果（最高/最低/平均分及各分数段分布） */
  const scoreStats = computed<ScoreStatisticsType | null>(() => {
    if (!scoreProp.value) return null

    const allScores = students.value
      .map((e) => getScore(e))
      .filter((s): s is number => s !== null && !Number.isNaN(s))

    if (allScores.length === 0) return null

    const maxScore = Math.max(...allScores)
    const minScore = Math.min(...allScores)
    const avgScore = allScores.reduce((a, b) => a + b, 0) / allScores.length

    // 最高分单列；其所在分数段的标签止于最高分之前。
    const getRangeLabel = (min: number, max: number): string => {
      const hasFractionalScore = allScores.some(
        (score) => score !== maxScore && score >= min && score < max + 1 && !Number.isInteger(score)
      )
      if (maxScore >= min && maxScore < max + 1) {
        return Number.isInteger(maxScore) && !hasFractionalScore
          ? `${min}-${maxScore - 1}分`
          : `${min}-低于${maxScore}分`
      }
      if (hasFractionalScore) return `${min}-低于${max + 1}分`
      return `${min}-${max}分`
    }

    const ranges = [
      { min: 90, max: Infinity, color: '#22c55e' },
      { min: 80, max: 89, color: '#3b82f6' },
      { min: 70, max: 79, color: '#eab308' },
      { min: 60, max: 69, color: '#f97316' }
    ].map((range) => ({ ...range, label: getRangeLabel(range.min, range.max) }))

    // 低分分数段（0-59 分，每 10 分一档）
    const lowScoreRanges = [
      { min: 50, max: 59, color: '#ef4444' },
      { min: 40, max: 49, color: '#dc2626' },
      { min: 30, max: 39, color: '#b91c1c' },
      { min: 20, max: 29, color: '#991b1b' },
      { min: 10, max: 19, color: '#7f1d1d' },
      { min: 0, max: 9, color: '#450a0a' }
    ].map((range) => ({ ...range, label: getRangeLabel(range.min, range.max) }))

    /** 统计指定分数区间内的人数和学生名单（按分数降序） */
    const getRangeData = (range: { min: number; max: number }) => {
      const isInRange = (score: number) =>
        score >= range.min && score < range.max + 1 && score !== maxScore
      const count = allScores.filter(isInRange).length
      const studentList = students.value
        .filter((e) => {
          const score = getScore(e)
          return score !== null && isInRange(score)
        })
        .sort((a, b) => (getScore(b) || 0) - (getScore(a) || 0))
        .map((e) => getStudentName(e))
      return { count, students: studentList }
    }

    const rangeData = ranges
      .map((range) => {
        const data = getRangeData(range)
        return { ...range, ...data }
      })
      .filter((r) => r.count > 0)

    const lowScoreData = lowScoreRanges
      .map((range) => {
        const data = getRangeData(range)
        return { ...range, ...data }
      })
      .filter((r) => r.count > 0)

    const topStudents = students.value
      .filter((e) => getScore(e) === maxScore)
      .map((e) => getStudentName(e))

    const bottomStudents = students.value
      .filter((e) => getScore(e) === minScore)
      .map((e) => getStudentName(e))

    // 低分学生（低于 60 分），按分数升序
    const allLowScoreStudents = students.value
      .filter((e) => {
        const score = getScore(e)
        return score !== null && score < 60
      })
      .sort((a, b) => (getScore(a) || 0) - (getScore(b) || 0))
      .map((e) => getStudentName(e))

    const maxCount = Math.max(...rangeData.map((r) => r.count), 1)

    return {
      maxScore,
      maxScoreCount: topStudents.length,
      topStudents,
      minScore,
      minScoreCount: bottomStudents.length,
      bottomStudents,
      avgScore: avgScore.toFixed(2),
      ranges: rangeData,
      lowScoreRanges: lowScoreData,
      lowScoreTotal: allLowScoreStudents.length,
      allLowScoreStudents,
      maxCount,
      totalCount: allScores.length
    }
  })

  /** 当前生效的低分阈值（平均分模式取平均分，自定义模式取设定值） */
  const effectiveThreshold = computed(() => {
    // 低分阈值支持两种模式：平均分 / 自定义固定值
    if (thresholdMode.value === 'average') {
      return scoreStats.value ? Number(scoreStats.value.avgScore) : 60
    }
    return threshold.value
  })

  /** 低于低分阈值的低分学生列表（按分数升序） */
  const belowThresholdStudents = computed(() => {
    if (!scoreProp.value) return []
    return students.value
      .filter((e) => {
        const score = getScore(e)
        return score !== null && score < effectiveThreshold.value
      })
      .sort((a, b) => (getScore(a) || 0) - (getScore(b) || 0))
  })

  // 平均分模式下自动将低分阈值同步为最新平均分
  watch(
    () => scoreStats.value,
    (newVal) => {
      if (newVal && thresholdMode.value === 'average') {
        threshold.value = parseFloat(newVal.avgScore)
      }
    },
    { immediate: true }
  )

  return {
    threshold,
    thresholdMode,
    effectiveThreshold,
    belowThresholdStudents,
    scoreStats,
    getScore
  }
}
