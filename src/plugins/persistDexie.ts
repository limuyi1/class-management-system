import type { PiniaPluginContext } from 'pinia'
import { db, DB_ID } from '@/db'
import type { Table } from 'dexie'

const tableNameMap: Record<string, Table<any>> = {
  dataSource: db.dataSource,
  wrongBook: db.wrongBook,
  setting: db.setting,
  configuration: db.configuration,
  theme: db.theme,
  aiConfig: db.aiConfig
}

export function createPersistedStateDexie() {
  return ({ store }: PiniaPluginContext) => {
    const storeId = store.$id
    const table = tableNameMap[storeId]

    if (!table) {
      return
    }

    const loadFromDB = async () => {
      try {
        const record = await table.get(DB_ID)
        if (record) {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { id: _id, ...state } = record as any
          store.$patch(state)
        }
      } catch (error) {
        console.error(`[PersistDexie] Failed to load ${storeId} from IndexedDB:`, error)
      }
    }

    loadFromDB()

    store.$subscribe(
      () => {
        try {
          const state = store.$state
          table.put({ id: DB_ID, ...state } as any)
        } catch (error) {
          console.error(`[PersistDexie] Failed to save ${storeId} to IndexedDB:`, error)
        }
      },
      { deep: true }
    )
  }
}
