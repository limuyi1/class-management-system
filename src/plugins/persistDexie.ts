import type { PiniaPluginContext } from 'pinia'
import { db, DB_ID } from '@/db'
import type { Table } from 'dexie'

let debounceTimer: ReturnType<typeof setTimeout> | null = null
const DEBOUNCE_DELAY = 300

const tableNameMap: Record<string, Table<any>> = {
  wrongBook: db.wrongBook,
  setting: db.setting,
  configuration: db.configuration,
  theme: db.theme,
  aiConfig: db.aiConfig
}

export function createPersistedStateDexie() {
  return async ({ store }: PiniaPluginContext) => {
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

    await loadFromDB()

    store.$subscribe(
      () => {
        if (debounceTimer) {
          clearTimeout(debounceTimer)
        }
        debounceTimer = setTimeout(async () => {
          try {
            const rawState = store.$state
            const clonableState = JSON.parse(JSON.stringify(rawState))
            await table.put({ id: DB_ID, ...clonableState } as any)
          } catch (error) {
            console.error(`[PersistDexie] Failed to save ${storeId} to IndexedDB:`, error)
          }
        }, DEBOUNCE_DELAY)
      },
      { deep: true }
    )
  }
}
