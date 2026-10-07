/**
 * 通用工具函数
 * 提供项目中多处使用的通用功能
 */

/**
 * 数组分组
 * 将一维数组按指定大小分割为二维数组
 * @param array - 待分割的数组
 * @param groupSize - 每组元素数量
 * @returns 分组后的二维数组
 */
export const groupArray = <T>(array: T[], groupSize: number): T[][] => {
  const groups: T[][] = []
  for (let i = 0; i < array.length; i += groupSize) {
    groups.push(array.slice(i, i + groupSize))
  }
  return groups
}

/**
 * 等待函数
 * 返回一个 Promise，在指定毫秒后 resolve
 * @param ms - 延迟毫秒数
 * @returns Promise<void>
 */
export const delay = (ms: number): Promise<void> => {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
