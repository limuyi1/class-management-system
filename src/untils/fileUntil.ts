/**
 * 文件处理工具函数
 * 提供文件与 Base64 互转等功能
 */

/**
 * 将 File 对象转换为 Base64 字符串（不含前缀）
 * @param file - File 对象
 * @returns Base64 字符串（不含 data:image/xxx;base64, 前缀）
 */
const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      const base64 = result.replace(/^data:image\/\w+;base64,/, '')
      resolve(base64)
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export { fileToBase64 }
