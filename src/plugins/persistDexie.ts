import type { PiniaPluginContext } from 'pinia'
import { liveQuery, type Observable } from 'dexie'
import { db, DB_ID } from '@/db'
import type { Table } from 'dexie'

const tableNameMap: Record<string, Table<any>> = {
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

    const loadFromDB = async () => {
      try {
        const record = await table.get(DB_ID)
        if (record) {
          if (isDataSource) {
            store.$patch({ items: record.data || [] })
          } else {
            const { id: _id, ...state } = record as any
            store.$patch(state)
          }
        }
      } catch (error) {
        console.error(`[PersistDexie] Failed to load ${storeId} from IndexedDB:`, error)
      }
    }

    if (isDataSource) {
      ;(store as any).isInitialLoading = false
    }
    await loadFromDB()
    if (isDataSource) {
      ;(store as any).isInitialLoading = true
    }

    const saveToDB = async () => {
      if (updatingStores.has(storeId)) {
        return
      }
      try {
        if (isDataSource) {
          await table.put({ id: DB_ID, data: store.$state.items } as any)
        } else {
          const rawState = store.$state
          const clonableState = JSON.parse(JSON.stringify(rawState))
          await table.put({ id: DB_ID, ...clonableState } as any)
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

    const observable$: Observable<any> = liveQuery(() => table.get(DB_ID)) as Observable<any>
    observable$.subscribe({
      next: (record) => {
        if (!record) return

        updatingStores.add(storeId)

        const { id: _id, ...state } = record as any
        store.$patch(state)

        updatingStores.delete(storeId)
      },
      error: (err) => {
        console.error(`[PersistDexie] LiveQuery error for ${storeId}:`, err)
      }
    })
  }
}
