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

/** 导出开始时捕获权限和业务指纹，结束时复验，避免下载切换后的旧数据。 */
export async function captureDownloadGuard(): Promise<() => Promise<void>> {
  if (import.meta.env.VITE_STORAGE_MODE === 'legacy') return async () => undefined
  const { apiRequest } = await import('@/api/client')
  const { serverState, flushServerState } = await import('@/repositories/v5StateRepository')
  await flushServerState()
  const owner = serverState.ownerId,
    id = serverState.workspaceId
  const identity = await apiRequest<{ id: string; role: string }>('/me/context')
  if (identity.role !== 'USER') throw new Error('当前身份不能导出教学数据')
  const state = id ? await apiRequest<{ fingerprint: string }>(`/v5/workspaces/${id}`) : undefined
  return async () => {
    if (owner !== serverState.ownerId || id !== serverState.workspaceId)
      throw new Error('账号或班级已切换，请重新导出')
    const user = await apiRequest<{ id: string; role: string }>('/me/context')
    if (user.id !== identity.id || user.role !== 'USER') throw new Error('导出权限已失效')
    if (
      state &&
      (await apiRequest<{ fingerprint: string }>(`/v5/workspaces/${id}`)).fingerprint !==
        state.fingerprint
    )
      throw new Error('导出期间数据已变化，请重新导出')
  }
}
const tasks = new Set<Promise<() => Promise<void>>>()
/** 导出任务共享开始时快照，生成完成后下载统一复验。 */
export function registerDownloadTask(): () => void {
  if (import.meta.env.VITE_STORAGE_MODE === 'legacy') return () => undefined
  const task = captureDownloadGuard()
  void task.catch(() => undefined)
  tasks.add(task)
  return () => {
    tasks.delete(task)
  }
}
/** 触发 Blob 下载，服务器模式在下载前复验身份及快照，延迟释放对象 URL。 */
export async function downloadBlob(blob: Blob, fileName: string): Promise<void> {
  if (import.meta.env.VITE_STORAGE_MODE !== 'legacy') {
    for (const task of tasks) await (await task)()
    await (
      await captureDownloadGuard()
    )()
  }
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}
