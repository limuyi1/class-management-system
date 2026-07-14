import type { PiniaPluginContext, StateTree, _DeepPartial } from 'pinia'
import { liveQuery, type Observable } from 'dexie'
import { db, DB_ID } from '@/db'
import type { Table } from 'dexie'
import type {
  AISettingsRecord,
  AppPreferencesRecord,
  OverviewAnalysisCacheRecord,
  ScoreSettingsRecord,
  ScoreNoticeStorageRecord,
  SeatingChartStorageRecord,
  StudentDatasetRecord,
  ThemePreferencesRecord,
  ToolPreferencesRecord,
  WrongBookStorageRecord
} from '@/types/Database'
import type { StudentDataType } from '@/types/StudentData'

import { useDataSourceStore } from '@/stores/data-source'
import { useSettingStore } from '@/stores/setting'
import { useConfigurationStore } from '@/stores/configuration'
import { useThemeStore } from '@/stores/theme'
import { useAIConfigStore } from '@/stores/ai-config'
import { useWrongBookStore } from '@/stores/wrong-book'
import { useOverviewAnalysisStore } from '@/stores/overview-analysis'
import { useToolsStore } from '@/stores/tools'
import { useScoreNoticeStore } from '@/stores/score-notice'
import { useSeatingChartStore } from '@/stores/seating-chart'
import { isDatabaseImporting } from '@/utils/persistDexieImportState'
import { normalizeScoreColumns } from '@/utils/settingMigrationUntil'
import { normalizeRecentScoreEntries, normalizeStoredStudents } from '@/utils/studentUntil'
import { DefaultAIPrompts } from '@/types/AIConfig'

type PersistableRecordType =
  | StudentDatasetRecord
  | ScoreSettingsRecord
  | ScoreNoticeStorageRecord
  | AppPreferencesRecord
  | ThemePreferencesRecord
  | AISettingsRecord
  | WrongBookStorageRecord
  | OverviewAnalysisCacheRecord
  | ToolPreferencesRecord
  | SeatingChartStorageRecord

interface DataSourceLikeStoreType {
  isInitialLoading: boolean
  $state: {
    students: StudentDataType[]
  }
  $patch: (partialState: { students: StudentDataType[] }) => void
}

const tableNameMap: Record<string, Table<PersistableRecordType>> = {
  setting: db.scoreSettings,
  configuration: db.appPreferences,
  theme: db.themePreferences,
  aiConfig: db.aiSettings,
  wrongBook: db.wrongBook,
  overviewAnalysis: db.overviewAnalysisCache,
  tools: db.toolPreferences,
  scoreNotice: db.scoreNotice,
  seatingChart: db.seatingCharts,
  dataSource: db.studentDataset
}

const updatingStores = new Set<string>()

const cloneState = <T>(state: T): T => JSON.parse(JSON.stringify(state)) as T

export function createPersistedStateDexie() {
  return async ({ store }: PiniaPluginContext) => {
    const storeId = store.$id
    const table = tableNameMap[storeId]

    if (!table) {
      return
    }

    const isDataSource = storeId === 'dataSource'
    const dataSourceStore = store as unknown as DataSourceLikeStoreType
    // 保存插件接入前的初始 state，用于 IndexedDB 记录被删除后恢复 store 默认值。
    // 不能依赖所有 store 都有 $reset：setup store（如 theme）没有 Pinia 自动生成的 $reset。
    const defaultState = cloneState(store.$state)
    const patchStateFromRecord = (record: PersistableRecordType) => {
      const stateRecord = record as unknown as Record<string, unknown>
      const { id, updatedAt, ...state } = stateRecord
      void id
      void updatedAt
      if (storeId === 'aiConfig' && state.prompts && typeof state.prompts === 'object') {
        state.prompts = { ...DefaultAIPrompts, ...(state.prompts as Record<string, unknown>) }
      }
      if (storeId === 'setting' && Array.isArray(state.scoreColumns)) {
        state.scoreColumns = normalizeScoreColumns(
          state.scoreColumns as Parameters<typeof normalizeScoreColumns>[0]
        )
      }
      if (storeId === 'configuration') {
        state.recentScoreEntries = normalizeRecentScoreEntries(state.recentScoreEntries)
      }
      store.$patch(state as _DeepPartial<StateTree>)
    }
    const resetStoreState = () => {
      // dataSource 在库中使用 { id, students } 结构，和 store.$state 字段不同，单独恢复。
      if (isDataSource) {
        dataSourceStore.$patch({ students: [] })
        return
      }

      store.$patch(cloneState(defaultState) as _DeepPartial<StateTree>)

      // 主题 store 还会把颜色写入 documentElement CSS 变量，仅 patch state 不会刷新页面外观。
      if (storeId === 'theme') {
        ;(store as unknown as { applyTheme?: () => void }).applyTheme?.()
      }
    }

    const loadFromDB = async () => {
      try {
        const record = await table.get(DB_ID)
        if (record) {
          if (isDataSource) {
            const dataRecord = record as StudentDatasetRecord
            dataSourceStore.$patch({ students: normalizeStoredStudents(dataRecord.students) })
          } else {
            patchStateFromRecord(record)
          }
        }
      } catch (error) {
        console.error(`[PersistDexie] Failed to load ${storeId} from IndexedDB:`, error)
      }
    }

    if (isDataSource) {
      dataSourceStore.isInitialLoading = false
    }
    await loadFromDB()
    if (isDataSource) {
      dataSourceStore.isInitialLoading = true
    }

    const saveToDB = async () => {
      if (updatingStores.has(storeId) || isDatabaseImporting()) {
        return
      }
      try {
        if (isDataSource) {
          const clonableData = JSON.parse(
            JSON.stringify(dataSourceStore.$state.students)
          ) as StudentDataType[]
          await table.put({
            id: DB_ID,
            students: clonableData,
            updatedAt: new Date().toISOString()
          } as StudentDatasetRecord)
        } else {
          const rawState = store.$state
          const clonableState = JSON.parse(JSON.stringify(rawState))
          await table.put({
            id: DB_ID,
            ...clonableState,
            updatedAt: new Date().toISOString()
          } as PersistableRecordType)
        }
      } catch (error) {
        console.error(`[PersistDexie] Failed to save ${storeId} to IndexedDB:`, error)
      }
    }

    store.$subscribe(
      async () => {
        await saveToDB()
      },
      { deep: true }
    )

    const observable$: Observable<PersistableRecordType | undefined> = liveQuery(() =>
      table.get(DB_ID)
    ) as Observable<PersistableRecordType | undefined>
    observable$.subscribe({
      next: (record) => {
        updatingStores.add(storeId)

        try {
          // 清空系统数据会删除整张表记录；liveQuery 会推送 undefined。
          // 这里必须恢复内存 store，否则页面仍会显示清空前的状态，并可能被订阅写回数据库。
          if (!record) {
            if (isDatabaseImporting()) {
              return
            }
            resetStoreState()
            return
          }

          if (isDataSource) {
            const dataRecord = record as StudentDatasetRecord
            dataSourceStore.$patch({ students: normalizeStoredStudents(dataRecord.students) })
          } else {
            patchStateFromRecord(record)
          }
        } finally {
          updatingStores.delete(storeId)
        }
      },
      error: (err) => {
        console.error(`[PersistDexie] LiveQuery error for ${storeId}:`, err)
      }
    })
  }
}

/**
 * 预加载所有 Store
 * 在应用启动时调用，提前完成所有 store 的数据库加载
 * 避免后续页面访问时因懒加载 store 而产生卡顿
 */
export function preloadAllStores() {
  void [
    useDataSourceStore(),
    useSettingStore(),
    useConfigurationStore(),
    useThemeStore(),
    useAIConfigStore(),
    useWrongBookStore(),
    useOverviewAnalysisStore(),
    useToolsStore(),
    useScoreNoticeStore()
    ,useSeatingChartStore()
  ]
}
