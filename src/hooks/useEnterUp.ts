import { onUnmounted, ref } from 'vue'

type EnterUpCallback = () => void | Promise<void>

/**
 * 全局回车键监听
 * 当用户在特定 name 属性的输入框上按下 Enter 键时触发回调，支持节流和防抖
 * @param nameProperty - 监听的 input name 属性值
 * @param fn - 回车时执行的回调函数
 * @param throttleMs - 节流间隔（毫秒），0 表示无节流
 */
export const useEnterUp = (nameProperty: string, fn: EnterUpCallback, throttleMs: number = 0) => {
  const isExecuting = ref(false)
  let lastExecTime = 0

  const handleGlobalKeyUp = async (event: KeyboardEvent) => {
    const target = event.target as HTMLInputElement | null
    const targetName = target?.name ?? null

    if (event.key === 'Enter' && targetName === nameProperty) {
      if (isExecuting.value) return

      const now = Date.now()
      if (throttleMs > 0 && now - lastExecTime < throttleMs) return

      isExecuting.value = true
      lastExecTime = now

      try {
        const result = fn()
        if (result instanceof Promise) {
          await result
        }
      } catch (error) {
        console.error('useEnterUp 执行出错:', error)
      } finally {
        isExecuting.value = false
      }
    }
  }

  document.addEventListener('keyup', handleGlobalKeyUp)

  onUnmounted(() => {
    document.removeEventListener('keyup', handleGlobalKeyUp)
  })
}
