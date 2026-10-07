import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import type { DatabaseType } from '../types/Account.js'

export const SCHEMA_VERSION = 10
const migrationNames = [
  '001-auth.sql',
  '002-workspaces.sql',
  '003-scores.sql',
  '004-comments-documents.sql',
  '005-classroom-tools.sql',
  '006-attachments.sql',
  '007-ai-settings.sql',
  '008-business-completion.sql',
  '009-attachment-order.sql',
  '010-managed-sessions.sql'
]

/** 按版本执行已提交 SQL，每版一个短事务；测试显式注入目录，不依赖 cwd。 */
export function migrate(
  database: DatabaseType,
  directory = fileURLToPath(new URL('../../migrations/', import.meta.url))
): void {
  database.exec(
    'PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=1000; PRAGMA synchronous=FULL;'
  )
  const version = database.prepare('PRAGMA user_version').get() as { user_version: number }
  if (version.user_version > SCHEMA_VERSION) throw new Error('数据库版本高于当前程序，禁止自动降级')
  for (let index = version.user_version; index < SCHEMA_VERSION; index++) {
    const sql = readFileSync(`${directory}/${migrationNames[index]}`, 'utf8')
    transaction(database, () => {
      database.exec(sql)
      database.exec(`PRAGMA user_version=${index + 1}`)
    })
  }
}

let savepointSequence = 0
/** 短写事务只接受同步函数；组合业务在外层事务内使用保存点，异常整批回滚。 */
export function transaction<T>(database: DatabaseType, action: () => T): T {
  const nested = database.inTransaction
  const savepoint = `business_${savepointSequence++}`
  database.exec(nested ? `SAVEPOINT ${savepoint}` : 'BEGIN IMMEDIATE')
  try {
    const result = action()
    database.exec(nested ? `RELEASE SAVEPOINT ${savepoint}` : 'COMMIT')
    return result
  } catch (error) {
    if (nested) {
      database.exec(`ROLLBACK TO SAVEPOINT ${savepoint}`)
      database.exec(`RELEASE SAVEPOINT ${savepoint}`)
    } else database.exec('ROLLBACK')
    throw error
  }
}
