import { sql } from 'drizzle-orm'
import { check, foreignKey, integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { registerSchema, schemaColumn } from './registry.js'

/** ai_quotas 的完整结构描述；修改 SQL 后须同步并执行 schema 一致性测试。 */
export const ai_quotas = registerSchema(
  'ai_quotas',
  sqliteTable(
    'ai_quotas',
    {
      ownerId: text('ownerId'),
      available: integer('available').notNull().default(sql.raw('0')),
      reserved: integer('reserved').notNull().default(sql.raw('0')),
      used: integer('used').notNull().default(sql.raw('0')),
      version: integer('version').notNull().default(sql.raw('1'))
    },
    (table) => [
      primaryKey({ columns: [table.ownerId] }),
      foreignKey({ columns: [table.ownerId], foreignColumns: [schemaColumn('users', 'id')] })
        .onUpdate('no action')
        .onDelete('no action'),
      check('ai_quotas_check_0', sql.raw('available>=0')),
      check('ai_quotas_check_1', sql.raw('reserved>=0')),
      check('ai_quotas_check_2', sql.raw('used>=0'))
    ]
  )
)
