import { db, DB_ID } from '@/db'
import type { Table } from 'dexie'

const OLD_PREFIX = '__scs-persisted__'
const MIGRATION_KEY = '__scs-migrated__'

const storeKeyMap: Record<string, Table<any>> = {
  dataSource: db.dataSource,
  wrongBook: db.wrongBook,
  setting: db.setting,
  configuration: db.configuration,
  theme: db.theme,
  aiConfig: db.aiConfig
}

async function parseZipson(json: string): Promise<any> {
  try {
    const { parse } = await import('zipson')
    return parse(json)
  } catch {
    return JSON.parse(json)
  }
}

export async function migrateFromLocalStorage(): Promise<boolean> {
  const alreadyMigrated = localStorage.getItem(MIGRATION_KEY)
  if (alreadyMigrated === 'true') {
    return false
  }

  try {
    const tables = Object.values(storeKeyMap)
    await db.transaction('rw', tables, async () => {
      for (const [storeId, table] of Object.entries(storeKeyMap)) {
        const localData = localStorage.getItem(OLD_PREFIX + storeId)
        if (localData) {
          try {
            const parsed = await parseZipson(localData)
            if (parsed && Object.keys(parsed).length > 0) {
              await table.put({ id: DB_ID, ...parsed })
            }
          } catch (error) {
            console.error(`[Migration] Failed to migrate ${storeId}:`, error)
          }
        }
      }
    })

    localStorage.setItem(MIGRATION_KEY, 'true')
    return true
  } catch (error) {
    console.error('[Migration] Failed:', error)
    return false
  }
}
