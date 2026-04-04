import { computed } from 'vue'

export interface UseProgressOptions<T> {
  data: { value: T[] }
  getValue: (item: T) => unknown
}

export const useProgress = <T>(options: UseProgressOptions<T>) => {
  const { data, getValue } = options

  const completedCount = computed(() => {
    return data.value.filter((item) => {
      const val = getValue(item)
      return val !== null && val !== '' && val !== undefined
    }).length
  })

  const percentage = computed(() => {
    const count = data.value.length
    if (count === 0) return 0
    return Number(((completedCount.value / count) * 100).toFixed(2))
  })

  const notCompletedCount = computed(() => {
    return data.value.length - completedCount.value
  })

  return {
    percentage,
    completedCount,
    notCompletedCount
  }
}
