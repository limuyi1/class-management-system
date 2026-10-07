import { onScopeDispose, ref, shallowRef } from 'vue'
import type { Ref } from 'vue'
import { apiRequest } from '@/api/client'

export interface ScopedApiResourceType<T> {
  state: Ref<T | null>
  loading: Ref<boolean>
  saving: Ref<boolean>
  errorMessage: Ref<string>
  clear: () => void
  load: () => Promise<void>
  write: (path: string, method: string, body: unknown) => Promise<void>
}

/** 业务快照、幂等重试均绑定固定账号/学期；旧响应不回填已切换的页面。 */
export function useScopedApiResource<T>(
  owner: () => string,
  workspace: () => string,
  reader: (ownerId: string, workspaceId: string, signal: AbortSignal) => Promise<T>
): ScopedApiResourceType<T> {
  const state = shallowRef<T | null>(null) as Ref<T | null>
  const loading = ref(false)
  const saving = ref(false)
  const errorMessage = ref('')
  let alive = true
  let generation = 0
  let controller = new AbortController()
  const keys = new Map<string, string>()

  function clear(): void {
    generation++
    controller.abort()
    state.value = null
    errorMessage.value = ''
    loading.value = false
    keys.clear()
  }
  /** 同范围刷新失败保留已加载快照与草稿，不清空已经展示的成绩。 */
  async function load(): Promise<void> {
    const scope = { owner: owner(), workspace: workspace(), generation: ++generation }
    controller.abort()
    controller = new AbortController()
    loading.value = true
    errorMessage.value = ''
    try {
      const result = await reader(scope.owner, scope.workspace, controller.signal)
      if (
        scope.generation !== generation ||
        scope.owner !== owner() ||
        scope.workspace !== workspace()
      )
        return
      state.value = result
    } catch (error) {
      if (scope.generation !== generation) return
      errorMessage.value = error instanceof Error ? error.message : '读取业务数据失败'
      throw error
    } finally {
      if (scope.generation === generation) loading.value = false
    }
  }
  async function write(path: string, method: string, body: unknown): Promise<void> {
    if (saving.value) throw new Error('正在保存，请稍候')
    const scope = { owner: owner(), workspace: workspace() }
    const fingerprint = JSON.stringify([scope.owner, scope.workspace, path, method, body])
    let key = keys.get(fingerprint)
    if (!key) {
      key = crypto.randomUUID()
      keys.set(fingerprint, key)
    }
    saving.value = true
    try {
      await apiRequest(path, { ownerId: scope.owner, method, body, idempotencyKey: key })
      if (alive && scope.owner === owner() && scope.workspace === workspace()) await load()
    } finally {
      saving.value = false
    }
  }
  onScopeDispose(() => {
    alive = false
    generation++
    controller.abort()
  })
  return { state, loading, saving, errorMessage, clear, load, write }
}
