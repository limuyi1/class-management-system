import type { PiniaPluginContext, StateTree, _DeepPartial } from 'pinia'
import { liveQuery, type Observable } from 'dexie'
import { db, DB_ID } from '@/db'
import type { Table } from 'dexie'
import type {
  AIConfigRecord,
  ConfigurationRecord,
  DataSourceRecord,
  SettingRecord,
  ThemeRecord,
  WrongBookRecord
} from '@/types/Database'
import type { StudentDataType } from '@/types/StudentData'

import { useDataSourceStore } from '@/stores/data-source'
import { useSettingStore } from '@/stores/setting'
import { useConfigurationStore } from '@/stores/configuration'
import { useThemeStore } from '@/stores/theme'
import { useAIConfigStore } from '@/stores/ai-config'
import { useWrongBookStore } from '@/stores/wrong-book'

type PersistableRecordType =
  | DataSourceRecord
  | WrongBookRecord
  | SettingRecord
  | ConfigurationRecord
  | ThemeRecord
  | AIConfigRecord

interface DataSourceLikeStoreType {
  isInitialLoading: boolean
  $state: {
    items: StudentDataType[]
  }
  $patch: (partialState: { items: StudentDataType[] }) => void
}

const tableNameMap: Record<string, Table<PersistableRecordType>> = {
  wrongBook: db.wrongBook,
  setting: db.setting,
  configuration: db.configuration,
  theme: db.theme,
  aiConfig: db.aiConfig,
  dataSource: db.dataSource
}

const updatingStores = new Set<string>()

export function createPersistedStateDexie() {
  return async ({ store }: PiniaPluginContext) => {
    const storeId = store.$id
    const table = tableNameMap[storeId]

    if (!table) {
      return
    }

    const isDataSource = storeId === 'dataSource'
    const dataSourceStore = store as unknown as DataSourceLikeStoreType
    const patchStateFromRecord = (record: PersistableRecordType) => {
      const stateRecord = record as unknown as Record<string, unknown>
      const { id, ...state } = stateRecord
      void id
      store.$patch(state as _DeepPartial<StateTree>)
    }

    const loadFromDB = async () => {
      try {
        const record = await table.get(DB_ID)
        if (record) {
          if (isDataSource) {
            const dataRecord = record as DataSourceRecord
            dataSourceStore.$patch({ items: dataRecord.data || [] })
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
      if (updatingStores.has(storeId)) {
        return
      }
      try {
        if (isDataSource) {
          const clonableData = JSON.parse(JSON.stringify(dataSourceStore.$state.items)) as StudentDataType[]
          await table.put({ id: DB_ID, data: clonableData } as DataSourceRecord)
        } else {
          const rawState = store.$state
          const clonableState = JSON.parse(JSON.stringify(rawState))
          await table.put({ id: DB_ID, ...clonableState } as PersistableRecordType)
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
        if (!record) return

        updatingStores.add(storeId)

        if (isDataSource) {
          const dataRecord = record as DataSourceRecord
          dataSourceStore.$patch({ items: dataRecord.data || [] })
        } else {
          patchStateFromRecord(record)
        }

        updatingStores.delete(storeId)
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
    useWrongBookStore()
  ]
  console.log('[PersistDexie] All stores preloaded')
}
