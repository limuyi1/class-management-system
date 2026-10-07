import { serverMode, loadServerWorkspace } from '@/repositories/v5StateRepository'
import { defineStore } from 'pinia'

import { db, DB_ID } from '@/db'

import type { WorkspaceCatalogType, WorkspaceSnapshotType } from '@/types/Workspace'

/** 目录由事务服务保存，不走业务 Store 的 main 记录持久化映射。 */
export const useWorkspaceStore = defineStore('workspace', {
  state: () => ({
    catalog: null as WorkspaceCatalogType | null,
    snapshots: [] as WorkspaceSnapshotType[]
  }),
  getters: {
    activePeriod: (state) =>
      state.catalog?.periods.find((period) => period.id === state.catalog?.activePeriodId),
    activeClassPeriods(): NonNullable<WorkspaceCatalogType['periods']> {
      return (
        this.catalog?.periods.filter((period) => period.classId === this.activePeriod?.classId) ??
        []
      )
    }
  },
  actions: {
    /** 重新读取目录和历史数据；当前业务数据仍来自原有 Store。 */
    async refresh(): Promise<void> {
      if (serverMode) {
        await loadServerWorkspace()
        return
      }
      this.catalog = (await db.workspaces.get(DB_ID)) ?? null
      this.snapshots = await db.workspaceSnapshots.toArray()
    }
  }
})
