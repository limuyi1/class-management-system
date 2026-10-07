import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import SQLite from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'

import * as schema from './schema.js'
import type { DatabaseType } from '../types/Account.js'
import type { Database as SQLiteDatabaseType } from 'better-sqlite3'
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'

/** 创建持久化连接；业务启动只检查版本，迁移由独立命令执行。 */
export function openDatabase(
  path = process.env.DATABASE_PATH || '../data/class-management.sqlite'
): {
  database: DatabaseType
  orm: BetterSQLite3Database<typeof schema>
  sqlite: SQLiteDatabaseType
} {
  const absolutePath = resolve(path)
  mkdirSync(dirname(absolutePath), { recursive: true })
  const sqlite = new SQLite(absolutePath)
  sqlite.pragma('foreign_keys=ON')
  sqlite.pragma('busy_timeout=1000')
  return { database: sqlite as DatabaseType, orm: drizzle(sqlite, { schema }), sqlite }
}
