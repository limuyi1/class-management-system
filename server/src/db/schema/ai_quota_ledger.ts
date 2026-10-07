import { sql } from 'drizzle-orm'
import { check, foreignKey, integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { registerSchema, schemaColumn } from './registry.js'

/** ai_quota_ledger 的完整结构描述；修改 SQL 后须同步并执行 schema 一致性测试。 */
export const ai_quota_ledger = registerSchema(
  'ai_quota_ledger',
  sqliteTable(
    'ai_quota_ledger',
    {
      id: text('id'),
      ownerId: text('ownerId').notNull(),
      actorId: text('actorId').notNull(),
      kind: text('kind').notNull(),
      delta: integer('delta').notNull(),
      reason: text('reason').notNull(),
      createdAt: integer('createdAt').notNull()
    },
    (table) => [
      primaryKey({ columns: [table.id] }),
      foreignKey({ columns: [table.actorId], foreignColumns: [schemaColumn('users', 'id')] })
        .onUpdate('no action')
        .onDelete('no action'),
      foreignKey({ columns: [table.ownerId], foreignColumns: [schemaColumn('users', 'id')] })
        .onUpdate('no action')
        .onDelete('no action'),
      check('ai_quota_ledger_check_0', sql.raw("kind IN ('ADJUST','RESERVE','SETTLE','RELEASE')"))
    ]
  )
)
