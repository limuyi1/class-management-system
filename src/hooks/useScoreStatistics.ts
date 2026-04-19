import { computed, ref, watch } from 'vue'
import type { ComputedRef } from 'vue'

import { NAME_PROP } from '@/types/Constants'
import type { StudentDataType } from '@/types/StudentData'

export interface ScoreRangeType {
  label: string
  min: number
  max: number
  color: string
  count: number
  students: string[]
}

export interface ScoreStatisticsType {
  maxScore: number
  maxScoreCount: number
  topStudents: string[]
  minScore: number
  minScoreCount: number
  bottomStudents: string[]
  avgScore: string
  ranges: ScoreRangeType[]
  lowScoreRanges: ScoreRangeType[]
  lowScoreTotal: number
  allLowScoreStudents: string[]
  maxCount: number
  totalCount: number
}

export type ScoreStudentType = StudentDataType

interface UseScoreStatisticsOptions {
  students: ComputedRef<StudentDataType[]>
  scoreProp: ComputedRef<string | null>
}

export function useScoreStatistics(options: UseScoreStatisticsOptions) {
  const { students, scoreProp } = options

  const threshold = ref(60)
  const thresholdMode = ref<'average' | 'custom'>('average')

  const getScore = (item: StudentDataType): number | null => {
    if (!scoreProp.value) return null
    const score = item[scoreProp.value]
    if (typeof score === 'number') return score
    if (typeof score === 'string') {
      const parsed = parseFloat(score)
      return Number.isNaN(parsed) ? null : parsed
    }
    return null
  }

  const getStudentName = (student: StudentDataType): string => {
    const name = student[NAME_PROP]
    return name === null || name === undefined ? '未命名' : String(name)
  }

  const scoreStats = computed<ScoreStatisticsType | null>(() => {
    if (!scoreProp.value) return null

    const allScores = students.value
      .map((e) => getScore(e))
      .filter((s): s is number => s !== null && !Number.isNaN(s))

    if (allScores.length === 0) return null

    const maxScore = Math.max(...allScores)
    const minScore = Math.min(...allScores)
    const avgScore = allScores.reduce((a, b) => a + b, 0) / allScores.length

    const ranges = [
      { label: '90-100分', min: 90, max: 100, color: '#22c55e' },
      { label: '80-89分', min: 80, max: 89, color: '#3b82f6' },
      { label: '70-79分', min: 70, max: 79, color: '#eab308' },
      { label: '60-69分', min: 60, max: 69, color: '#f97316' }
    ]

    const lowScoreRanges = [
      { label: '50-59分', min: 50, max: 59, color: '#ef4444' },
      { label: '40-49分', min: 40, max: 49, color: '#dc2626' },
      { label: '30-39分', min: 30, max: 39, color: '#b91c1c' },
      { label: '20-29分', min: 20, max: 29, color: '#991b1b' },
      { label: '10-19分', min: 10, max: 19, color: '#7f1d1d' },
      { label: '0-9分', min: 0, max: 9, color: '#450a0a' }
    ]

    const getRangeData = (range: { min: number; max: number }) => {
      const count = allScores.filter((s) => s >= range.min && s <= range.max).length
      const studentList = students.value
        .filter((e) => {
          const score = getScore(e)
          return score !== null && score >= range.min && score <= range.max
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

  const effectiveThreshold = computed(() => {
    // 低分阈值支持两种模式：平均分 / 自定义固定值
    if (thresholdMode.value === 'average') {
      return scoreStats.value ? Number(scoreStats.value.avgScore) : 60
    }
    return threshold.value
  })

  const belowThresholdStudents = computed(() => {
    if (!scoreProp.value) return []
    return students.value
      .filter((e) => {
        const score = getScore(e)
        return score !== null && score < effectiveThreshold.value
      })
      .sort((a, b) => (getScore(a) || 0) - (getScore(b) || 0))
  })

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
