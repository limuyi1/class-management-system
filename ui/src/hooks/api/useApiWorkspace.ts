import { onScopeDispose, ref } from 'vue'

import { apiRequest } from '@/api/client'
import type { EnrollmentType, WorkspaceRecordType } from '@/types/ApiWorkspace'

/** 账号与学期切换均使用代次+取消，晚到响应不能污染新账号缓存。 */
export function useApiWorkspace(initialOwnerId: string) {
  const ownerId = ref(initialOwnerId)
  const catalog = ref<WorkspaceRecordType[]>([])
  const workspace = ref<WorkspaceRecordType | null>(null)
  const students = ref<EnrollmentType[]>([])
  const loading = ref(false)
  const loadError = ref('')
  let generation = 0
  let controller = new AbortController()
  const pending = new Set<Promise<unknown>>()

  function beginScope(): { owner: string; generation: number; signal: AbortSignal } {
    generation++
    controller.abort()
    controller = new AbortController()
    return { owner: ownerId.value, generation, signal: controller.signal }
  }

  /** 未保存表单由调用页面确认；已提交写入在切换前必须成功，失败保留当前归属。 */
  async function settleWrites(): Promise<void> {
    await Promise.all([...pending])
  }

  async function loadPeriod(id: string): Promise<void> {
    const scope = beginScope()
    loading.value = true
    loadError.value = ''
    workspace.value = null
    students.value = []
    try {
      const result = await apiRequest<{
        workspace: WorkspaceRecordType
        students: EnrollmentType[]
      }>(`/workspaces/${encodeURIComponent(id)}/state`, {
        ownerId: scope.owner,
        signal: scope.signal
      })
      if (scope.generation !== generation || scope.owner !== ownerId.value) return
      workspace.value = result.workspace
      students.value = result.students
    } catch (error) {
      if (scope.generation !== generation) return
      loadError.value = error instanceof Error ? error.message : '读取名单失败'
      throw error
    } finally {
      if (scope.generation === generation) loading.value = false
    }
  }

  /** 刷新目录保留原选择，只在该账号仍有同一期时恢复；绝不跨账号复用 ID。 */
  async function loadCatalog(preferredId?: string): Promise<void> {
    const scope = beginScope()
    const oldId = preferredId || workspace.value?.id
    loading.value = true
    loadError.value = ''
    let selectedId: string | undefined
    try {
      const result = await apiRequest<{ items: WorkspaceRecordType[] }>('/workspaces', {
        ownerId: scope.owner,
        signal: scope.signal
      })
      if (scope.generation !== generation || scope.owner !== ownerId.value) return
      catalog.value = result.items
      const selected =
        result.items.find((item) => item.id === oldId) || result.items[result.items.length - 1]
      selectedId = selected?.id
      if (!selected) {
        workspace.value = null
        students.value = []
      }
    } catch (error) {
      if (scope.generation !== generation) return
      loadError.value = error instanceof Error ? error.message : '读取班级失败'
      throw error
    } finally {
      if (scope.generation === generation) loading.value = false
    }
    // 子请求切换代次后仍要向提交者报告失败，不能把读失败当作保存成功。
    if (selectedId && scope.generation === generation) await loadPeriod(selectedId)
  }

  /** 权限撤销时先同步清空缓存，无须等待旧范围的网络操作完成。 */
  function resetOwner(id: string): void {
    beginScope()
    ownerId.value = id
    catalog.value = []
    workspace.value = null
    students.value = []
    loadError.value = ''
    loading.value = false
  }

  async function switchOwner(id: string): Promise<void> {
    await settleWrites()
    resetOwner(id)
    await loadCatalog()
  }

  /** 请求归属与幂等键由发起时捕获；切换后任务仍不能改写其他账号。 */
  async function write<T>(path: string, method: string, body: unknown, key: string): Promise<T> {
    const operation = apiRequest<T>(path, {
      method,
      body,
      ownerId: ownerId.value,
      idempotencyKey: key
    })
    pending.add(operation)
    try {
      return await operation
    } finally {
      pending.delete(operation)
    }
  }

  onScopeDispose(() => {
    generation++
    controller.abort()
  })
  return {
    ownerId,
    catalog,
    workspace,
    students,
    loading,
    loadError,
    loadCatalog,
    loadPeriod,
    switchOwner,
    resetOwner,
    write,
    settleWrites
  }
}
