/** 浏览器下载及导出文件名的公共工具。 */

/** 清理文件名中的非法字符，空名称使用业务提供的默认名称。 */
export function sanitizeExportFileName(value: string, fallback: string): string {
  return value.replace(/[\\/:*?"<>|]/g, '_').trim() || fallback
}

/** 使用本地日期生成 YYYY-MM-DD，避免 UTC 日期偏移。 */
export function formatExportDate(date: Date = new Date()): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/** 触发 Blob 下载，延迟释放对象 URL，给浏览器留出读取时间。 */
export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}
