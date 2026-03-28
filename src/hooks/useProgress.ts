import { computed } from 'vue'

export interface UseProgressOptions {
  data: { value: any[] }
  getValue: (item: any) => any
}

export const useProgress = (options: UseProgressOptions) => {
  const { data, getValue } = options

  const completedCount = computed(() => {
    return data.value.filter((item) => {
      const val = getValue(item)
      return val !== null && val !== '' && val !== undefined && !isNaN(val)
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
