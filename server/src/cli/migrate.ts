import { mkdirSync } from 'node:fs'
import { resolve } from 'node:path'

import { openDatabase } from '../db/index.js'
import { migrate, SCHEMA_VERSION } from '../db/migrate.js'

/** 已有数据库升级前通过 Online Backup API 保存一致副本，不能只复制 .db。 */
const { database, sqlite } = openDatabase()
try {
  const version = database.prepare('PRAGMA user_version').get() as { user_version: number }
  if (version.user_version > 0 && version.user_version < SCHEMA_VERSION) {
    const directory = resolve('../data/backups')
    mkdirSync(directory, { recursive: true })
    await sqlite.backup(resolve(directory, `before-migrate-${Date.now()}.sqlite`))
  }
  migrate(database)
  console.log('数据库 schema 已就绪')
} finally {
  database.close()
}
