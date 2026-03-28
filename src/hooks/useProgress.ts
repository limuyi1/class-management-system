import { computed } from 'vue'

/**
 * 进度计算配置选项
 * @property data - 数据源数组（通过 storeToRefs 包装的响应式对象）
 * @property getValue - 获取数据项值的函数，用于判断该项是否已完成
 */
export interface UseProgressOptions {
  /** 数据源数组 */
  data: { value: any[] }
  /** 获取数据项值的函数 */
  getValue: (item: any) => any
}

/**
 * 通用进度计算 Hook
 * 用于计算分数录入、评语填写等场景的完成进度
 * @param options - 配置选项，包含数据源和值获取函数
 * @returns percentage - 完成百分比, completedCount - 已完成数量, notCompletedCount - 未完成数量
 *
 * @example
 * const { percentage, completedCount, notCompletedCount } = useProgress({
 *   data: originList,
 *   getValue: (item) => item.score
 * })
 */
export const useProgress = (options: UseProgressOptions) => {
  const { data, getValue } = options

  /**
   * 已完成数量
   * 过滤掉空值（null、undefined、空字符串）后的有效数据数量
   */
  const completedCount = computed(() => {
    return data.value.filter((item) => {
      const val = getValue(item)
      return val !== null && val !== '' && val !== undefined
    }).length
  })

  /**
   * 完成百分比
   * 已完成数量 / 总数量，保留两位小数
   */
  const percentage = computed(() => {
    const count = data.value.length
    if (count === 0) return 0
    return Number(((completedCount.value / count) * 100).toFixed(2))
  })

  /**
   * 未完成数量
   * 总数量 - 已完成数量
   */
  const notCompletedCount = computed(() => {
    return data.value.length - completedCount.value
  })

  return {
    percentage,
    completedCount,
    notCompletedCount
  }
}
