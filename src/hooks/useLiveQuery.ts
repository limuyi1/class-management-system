import { ref, onUnmounted } from 'vue'
import type { Ref } from 'vue'
import { liveQuery, type Observable } from 'dexie'

/**
 * Dexie liveQuery 的 Vue 封装
 * 将 IndexedDB 的响应式查询结果绑定为 Vue Ref，组件卸载时自动取消订阅
 * @param querier - 返回 Promise 的查询函数
 * @returns 响应式 Ref（初始值为 undefined）
 */
export function useLiveQuery<T>(querier: () => Promise<T>): Ref<T | undefined> {
  const result = ref<T>()
  let subscription: { unsubscribe: () => void } | null = null

  const init = () => {
    try {
      const observable$: Observable<T> = liveQuery(querier) as Observable<T>
      subscription = observable$.subscribe({
        next: (value: T) => {
          result.value = value
        },
        error: (err: Error) => {
          console.error('[useLiveQuery] Query error:', err)
        }
      })
    } catch (error) {
      console.error('[useLiveQuery] Failed to start query:', error)
    }
  }

  init()

  onUnmounted(() => {
    if (subscription) {
      subscription.unsubscribe()
      subscription = null
    }
  })

  return result
}
