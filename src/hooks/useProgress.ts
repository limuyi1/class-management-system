import { computed } from 'vue'

export interface UseProgressOptions<T> {
  /** 数据数组（Ref） */
  data: { value: T[] }
  /** 从数据项中提取当前值的函数 */
  getValue: (item: T) => unknown
}

/**
 * 进度统计
 * 统计数组中已填写（非空）项的数量和占比
 * @returns percentage（完成百分比）、completedCount（已完成数）、notCompletedCount（未完成数）
 */
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
