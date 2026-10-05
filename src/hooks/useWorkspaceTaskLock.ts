import { onBeforeUnmount, watch } from 'vue'

import { blockWorkspaceChanges } from '@/utils/workspaceSessionUtil'

import type { Ref } from 'vue'

/** 导出运行期间锁定班级学期切换，防止整页刷新丢失尚未下载的结果。 */
export function useWorkspaceTaskLock(active: Ref<boolean>, reason: string): void {
  let release: (() => void) | undefined
  watch(
    active,
    (value) => {
      release?.()
      release = value ? blockWorkspaceChanges(reason) : undefined
    },
    { immediate: true, flush: 'sync' }
  )
  onBeforeUnmount(() => release?.())
}
