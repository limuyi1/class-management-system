import { onUnmounted, ref } from 'vue'

/**
 * 监听回车事件（确保同时只执行一次，支持同步/异步函数）
 * @param nameProperty 需要监听的元素 name 属性
 * @param fn 执行函数（可以是异步函数）
 * @param throttleMs 最小执行间隔（毫秒），默认 0 表示无间隔限制
 */
export const useEnterUp = (nameProperty: string, fn: Function, throttleMs: number = 0) => {
  const isExecuting = ref(false) // 执行锁
  let lastExecTime = 0

  const handleGlobalKeyUp = async (event: KeyboardEvent) => {
    const target = event.target as HTMLElement | null
    const targetName = (target as any)?.name ?? null

    if (event.key === 'Enter' && targetName === nameProperty) {
      // 1. 锁机制：如果正在执行，直接忽略本次回车
      if (isExecuting.value) return

      // 2. 节流（可选）：如果两次执行间隔不足，则跳过
      const now = Date.now()
      if (throttleMs > 0 && now - lastExecTime < throttleMs) return

      // 3. 加锁并更新时间
      isExecuting.value = true
      lastExecTime = now

      try {
        // 4. 执行函数，并等待它完成（如果是异步函数）
        const result = fn()
        if (result instanceof Promise) {
          await result
        }
      } catch (error) {
        console.error('useEnterUp 执行出错:', error)
      } finally {
        // 5. 无论成功或失败，都要释放锁
        isExecuting.value = false
      }
    }
  }

  document.addEventListener('keyup', handleGlobalKeyUp)

  onUnmounted(() => {
    document.removeEventListener('keyup', handleGlobalKeyUp)
  })
}
