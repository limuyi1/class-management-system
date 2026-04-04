import { ref, onUnmounted } from 'vue'
import { liveQuery, type Observable } from 'dexie'

export function useLiveQuery<T>(querier: () => Promise<T>): { value: T | undefined } {
  const result = ref<T>() as any
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
