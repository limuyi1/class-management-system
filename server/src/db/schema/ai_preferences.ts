import { sql } from 'drizzle-orm'
import { check, foreignKey, integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { registerSchema, schemaColumn } from './registry.js'

/** ai_preferences 的完整结构描述；修改 SQL 后须同步并执行 schema 一致性测试。 */
export const ai_preferences = registerSchema(
  'ai_preferences',
  sqliteTable(
    'ai_preferences',
    {
      ownerId: text('ownerId'),
      mode: text('mode').notNull().default(sql.raw("'PLATFORM'")),
      version: integer('version').notNull().default(sql.raw('1'))
    },
    (table) => [
      primaryKey({ columns: [table.ownerId] }),
      foreignKey({ columns: [table.ownerId], foreignColumns: [schemaColumn('users', 'id')] })
        .onUpdate('no action')
        .onDelete('no action'),
      check('ai_preferences_check_0', sql.raw("mode IN ('PLATFORM','PERSONAL')"))
    ]
  )
)
