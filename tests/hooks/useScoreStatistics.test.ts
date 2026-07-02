import { describe, expect, it } from 'vitest'
import { computed, ref } from 'vue'
import { useScoreStatistics } from '../../src/hooks/useScoreStatistics'

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
})
