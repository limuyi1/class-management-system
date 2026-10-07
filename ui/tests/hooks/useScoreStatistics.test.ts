/**
 * useScoreStatistics 组合式函数测试
 * 覆盖：分数统计（最高/最低/平均分、人数）、分数段区间划分与最高分排除、
 * 无效高分区隐藏、低于阈值学生筛选、阈值随平均分联动、
 * 最高/最低分并列计数、字符串分数取值等边界场景。
 */

import { describe, expect, it } from 'vitest'
import { computed, ref } from 'vue'
import { useScoreStatistics } from '../../src/hooks/useScoreStatistics'

// 目标：验证成绩统计与分数段分布计算在各边界输入下的正确性
describe('useScoreStatistics', () => {
  it('should return null stats when no score prop', () => {
    const students = computed(() => [
      { name: '张三', yu3_wen2: 85 },
      { name: '李四', yu3_wen2: 90 }
    ])
    const scoreProp = computed(() => null)

    const { threshold, belowThresholdStudents, scoreStats } = useScoreStatistics({
      students,
      scoreProp
    })

    expect(threshold.value).toBe(60)
    expect(belowThresholdStudents.value).toEqual([])
    expect(scoreStats.value).toBeNull()
  })

  it('should calculate score statistics correctly', () => {
    const students = computed(() => [
      { name: '张三', yu3_wen2: 85 },
      { name: '李四', yu3_wen2: 90 },
      { name: '王五', yu3_wen2: 95 }
    ])
    const scoreProp = computed(() => 'yu3_wen2')

    const { scoreStats } = useScoreStatistics({
      students,
      scoreProp
    })

    expect(scoreStats.value).not.toBeNull()
    expect(scoreStats.value!.maxScore).toBe(95)
    expect(scoreStats.value!.minScore).toBe(85)
    expect(scoreStats.value!.avgScore).toBe('90.00')
    expect(scoreStats.value!.totalCount).toBe(3)
  })

  it('should calculate ranges correctly', () => {
    const students = computed(() => [
      { name: '张三', score: 92 },
      { name: '李四', score: 85 },
      { name: '王五', score: 72 },
      { name: '赵六', score: 65 }
    ])
    const scoreProp = computed(() => 'score')

    const { scoreStats } = useScoreStatistics({
      students,
      scoreProp
    })

    expect(scoreStats.value).not.toBeNull()
    expect(scoreStats.value!.ranges).toHaveLength(3)
    expect(scoreStats.value!.ranges[0].label).toBe('80-89分')
  })

  it('should exclude max score from distribution ranges', () => {
    const students = computed(() => [
      { name: '张三', score: 99 },
      { name: '李四', score: 98 },
      { name: '王五', score: 95 },
      { name: '赵六', score: 89 }
    ])
    const scoreProp = computed(() => 'score')

    const { scoreStats } = useScoreStatistics({
      students,
      scoreProp
    })

    expect(scoreStats.value!.maxScore).toBe(99)
    expect(scoreStats.value!.ranges[0].label).toBe('90-98分')
    expect(scoreStats.value!.ranges[0].students).toEqual(['李四', '王五'])
  })

  it('should hide invalid higher ranges when max score is below them', () => {
    const students = computed(() => [
      { name: '张三', score: 88 },
      { name: '李四', score: 87 },
      { name: '王五', score: 81 },
      { name: '赵六', score: 72 }
    ])
    const scoreProp = computed(() => 'score')

    const { scoreStats } = useScoreStatistics({
      students,
      scoreProp
    })

    expect(scoreStats.value!.maxScore).toBe(88)
    expect(scoreStats.value!.ranges.map((range) => range.label)).toEqual(['80-87分', '70-79分'])
    expect(scoreStats.value!.ranges[0].students).toEqual(['李四', '王五'])
  })

  it('should filter below threshold students', () => {
    const students = computed(() => [
      { name: '张三', score: 92 },
      { name: '李四', score: 55 },
      { name: '王五', score: 45 }
    ])
    const scoreProp = computed(() => 'score')

    const { belowThresholdStudents } = useScoreStatistics({
      students,
      scoreProp
    })

    expect(belowThresholdStudents.value).toHaveLength(2)
  })

  it('should update threshold when avgScore changes', () => {
    const studentsRef = ref<Array<{ name: string; score: number }>>([
      { name: '张三', score: 70 }
    ])
    const students = computed(() => studentsRef.value)
    const scoreProp = computed(() => 'score')

    const { threshold } = useScoreStatistics({
      students,
      scoreProp
    })

    expect(threshold.value).toBe(70)

    studentsRef.value = [{ name: '李四', score: 90 }]
  })

  it('should return empty ranges when no students', () => {
    const students = computed(() => [])
    const scoreProp = computed(() => 'score')

    const { scoreStats } = useScoreStatistics({
      students,
      scoreProp
    })

    expect(scoreStats.value).toBeNull()
  })

  it('should identify top and bottom students', () => {
    const students = computed(() => [
      { name: '张三', score: 100 },
      { name: '李四', score: 50 },
      { name: '王五', score: 100 }
    ])
    const scoreProp = computed(() => 'score')

    const { scoreStats } = useScoreStatistics({
      students,
      scoreProp
    })

    expect(scoreStats.value!.maxScore).toBe(100)
    expect(scoreStats.value!.maxScoreCount).toBe(2)
    expect(scoreStats.value!.minScore).toBe(50)
    expect(scoreStats.value!.minScoreCount).toBe(1)
  })

  it('should get score from student correctly', () => {
    const students = computed(() => [{ name: '张三', score: 85 }])
    const scoreProp = computed(() => 'score')

    const { getScore } = useScoreStatistics({
      students,
      scoreProp
    })

    expect(getScore({ name: '张三', score: 85 })).toBe(85)
    expect(getScore({ name: '李四' })).toBeNull()
  })

  it('should handle string score values', () => {
    const students = computed(() => [
      { name: '张三', score: '85' },
      { name: '李四', score: '90' }
    ])
    const scoreProp = computed(() => 'score')

    const { scoreStats } = useScoreStatistics({
      students,
      scoreProp
    })

    expect(scoreStats.value).not.toBeNull()
    expect(scoreStats.value!.avgScore).toBe('87.50')
  })

  it('counts fractional scores in exactly one range and accepts scores above 100', () => {
    const students = computed(() => [
      { name: '张三', score: 110 },
      { name: '李四', score: 100.5 },
      { name: '王五', score: 89.5 },
      { name: '赵六', score: 59.5 }
    ])
    const { scoreStats } = useScoreStatistics({
      students,
      scoreProp: computed(() => 'score')
    })

    expect(scoreStats.value!.ranges.map((range) => range.count)).toEqual([1, 1])
    expect(scoreStats.value!.ranges[0].label).toBe('90-低于110分')
    expect(scoreStats.value!.lowScoreRanges[0].count).toBe(1)
  })

  it('matches the 56-student example with tied top scores excluded from 90-98', () => {
    const bands = [
      { min: 90, count: 10 },
      { min: 80, count: 12 },
      { min: 70, count: 11 },
      { min: 60, count: 9 },
      { min: 50, count: 6 },
      { min: 40, count: 5 },
      { min: 30, count: 1 }
    ]
    let index = 0
    const students = computed(() => [
      { name: '郭锦睿', score: 99 },
      { name: '汪梦婷', score: 99 },
      ...bands.flatMap(({ min, count }) =>
        Array.from({ length: count }, () => {
          const current = index++
          return { name: `学生${current + 1}`, score: min + 4 + (current < 40 ? 1 : 0) }
        })
      )
    ])
    const { scoreStats } = useScoreStatistics({
      students,
      scoreProp: computed(() => 'score')
    })

    expect(scoreStats.value).toMatchObject({
      totalCount: 56,
      maxScore: 99,
      maxScoreCount: 2,
      topStudents: ['郭锦睿', '汪梦婷'],
      avgScore: '74.18'
    })
    expect([...scoreStats.value!.ranges, ...scoreStats.value!.lowScoreRanges].map((range) => [
      range.label,
      range.count
    ])).toEqual([
      ['90-98分', 10],
      ['80-89分', 12],
      ['70-79分', 11],
      ['60-69分', 9],
      ['50-59分', 6],
      ['40-49分', 5],
      ['30-39分', 1]
    ])
  })

  it('uses 90-99 for a top score of 100 and omits an empty 90-89 band', () => {
    const students = ref([
      { name: '甲', score: 100 },
      { name: '乙', score: 99 },
      { name: '丙', score: 90 }
    ])
    const { scoreStats } = useScoreStatistics({
      students: computed(() => students.value),
      scoreProp: computed(() => 'score')
    })

    expect(scoreStats.value!.ranges[0]).toMatchObject({ label: '90-99分', count: 2 })
    students.value = [
      { name: '甲', score: 90 },
      { name: '乙', score: 80 },
      { name: '丙', score: 70 }
    ]
    expect(scoreStats.value!.ranges.map((range) => range.label)).toEqual(['80-89分', '70-79分'])
  })

  it('keeps fractional scores below the top score and names the boundary clearly', () => {
    const students = computed(() => [
      { name: '甲', score: 99.5 },
      { name: '乙', score: 99.5 },
      { name: '丙', score: 99.4 },
      { name: '丁', score: 89.5 }
    ])
    const { scoreStats } = useScoreStatistics({
      students,
      scoreProp: computed(() => 'score')
    })

    expect(scoreStats.value!.maxScoreCount).toBe(2)
    expect(scoreStats.value!.ranges[0]).toMatchObject({
      label: '90-低于99.5分',
      count: 1,
      students: ['丙']
    })
    expect(scoreStats.value!.ranges[1]).toMatchObject({ label: '80-低于90分', count: 1 })
  })

  it('excludes the highest score from low score bands too', () => {
    const students = computed(() => [
      { name: '甲', score: 55 },
      { name: '乙', score: 54 },
      { name: '丙', score: 45 }
    ])
    const { scoreStats } = useScoreStatistics({
      students,
      scoreProp: computed(() => 'score')
    })

    expect(scoreStats.value!.lowScoreRanges.map((range) => [range.label, range.count])).toEqual([
      ['50-54分', 1],
      ['40-49分', 1]
    ])
    expect(scoreStats.value!.topStudents).toEqual(['甲'])
    expect(scoreStats.value!.lowScoreTotal).toBe(3)
  })
})
