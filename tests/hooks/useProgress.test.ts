import { describe, expect, it } from 'vitest'
import { useProgress } from '../../src/hooks/useProgress'
import { ref } from 'vue'

describe('useProgress', () => {
  it('should return 0 percentage for empty data', () => {
    const data = ref<Array<{ score: number | null }>>([])
    const { percentage, completedCount, notCompletedCount } = useProgress({
      data,
      getValue: (item) => item.score
    })

    expect(percentage.value).toBe(0)
    expect(completedCount.value).toBe(0)
    expect(notCompletedCount.value).toBe(0)
  })

  it('should return 0 percentage when no items have values', () => {
    const data = ref<Array<{ score: number | null }>>([
      { score: null },
      { score: null },
      { score: null }
    ])
    const { percentage, completedCount, notCompletedCount } = useProgress({
      data,
      getValue: (item) => item.score
    })

    expect(percentage.value).toBe(0)
    expect(completedCount.value).toBe(0)
    expect(notCompletedCount.value).toBe(3)
  })

  it('should return 100 percentage when all items have values', () => {
    const data = ref<Array<{ score: number | null }>>([{ score: 85 }, { score: 90 }, { score: 78 }])
    const { percentage, completedCount, notCompletedCount } = useProgress({
      data,
      getValue: (item) => item.score
    })

    expect(percentage.value).toBe(100)
    expect(completedCount.value).toBe(3)
    expect(notCompletedCount.value).toBe(0)
  })

  it('should calculate correct percentage for partial completion', () => {
    const data = ref<Array<{ score: number | null }>>([
      { score: 85 },
      { score: null },
      { score: 90 },
      { score: null }
    ])
    const { percentage, completedCount, notCompletedCount } = useProgress({
      data,
      getValue: (item) => item.score
    })

    expect(percentage.value).toBe(50)
    expect(completedCount.value).toBe(2)
    expect(notCompletedCount.value).toBe(2)
  })

  it('should treat empty string as incomplete', () => {
    const data = ref<Array<{ name: string }>>([{ name: 'Alice' }, { name: '' }, { name: 'Bob' }])
    const { percentage, completedCount, notCompletedCount } = useProgress({
      data,
      getValue: (item) => item.name
    })

    expect(percentage.value).toBeCloseTo(66.67, 1)
    expect(completedCount.value).toBe(2)
    expect(notCompletedCount.value).toBe(1)
  })

  it('should treat undefined as incomplete', () => {
    const data = ref<Array<{ value?: number }>>([{ value: 1 }, { value: undefined }, { value: 2 }])
    const { percentage, completedCount, notCompletedCount } = useProgress({
      data,
      getValue: (item) => item.value
    })

    expect(percentage.value).toBeCloseTo(66.67, 1)
    expect(completedCount.value).toBe(2)
    expect(notCompletedCount.value).toBe(1)
  })

  it('should work with number value 0 as complete', () => {
    const data = ref<Array<{ value: number }>>([{ value: 1 }, { value: 0 }, { value: 2 }])
    const { percentage, completedCount, notCompletedCount } = useProgress({
      data,
      getValue: (item) => item.value
    })

    expect(percentage.value).toBe(100)
    expect(completedCount.value).toBe(3)
    expect(notCompletedCount.value).toBe(0)
  })
})
