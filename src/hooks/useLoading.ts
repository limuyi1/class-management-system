import { ElLoading } from 'element-plus'

type LoadingInstanceType = ReturnType<typeof ElLoading.service>

let globalLoadingInstance: LoadingInstanceType | null = null

/**
 * 启动全局加载遮罩
 * @param text - 加载提示文本
 * @param background - 遮罩背景色（可选）
 */
export function startLoading(text: string, background?: string): LoadingInstanceType {
  globalLoadingInstance = ElLoading.service({
    lock: true,
    text,
    ...(background ? { background } : {})
  })
  return globalLoadingInstance
}

/** 关闭全局加载遮罩 */
export function stopLoading(): void {
  globalLoadingInstance?.close()
  globalLoadingInstance = null
}

/** 更新加载文本（用于进度提示） */
export function updateLoadingText(text: string): void {
  globalLoadingInstance?.setText(text)
}

/**
 * 包装异步函数，自动管理加载遮罩生命周期
 * @param text - 加载提示文本
 * @param fn - 要执行的异步函数
 * @param background - 遮罩背景色（可选）
 */
export async function runWithLoading<T>(
  text: string,
  fn: () => Promise<T>,
  background?: string
): Promise<T> {
  startLoading(text, background)
  try {
    return await fn()
  } finally {
    stopLoading()
  }
}
