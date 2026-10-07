import { sql } from 'drizzle-orm'
import { check, foreignKey, integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { registerSchema, schemaColumn } from './registry.js'

/** ai_token_reservations 的完整结构描述；修改 SQL 后须同步并执行 schema 一致性测试。 */
export const ai_token_reservations = registerSchema(
  'ai_token_reservations',
  sqliteTable(
    'ai_token_reservations',
    {
      id: text('id'),
      ownerId: text('ownerId').notNull(),
      actorId: text('actorId').notNull(),
      amount: integer('amount').notNull(),
      actual: integer('actual'),
      state: text('state').notNull(),
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
      check('ai_token_reservations_check_0', sql.raw('amount>0')),
      check('ai_token_reservations_check_1', sql.raw("state IN ('PENDING','SETTLED','RELEASED')"))
    ]
  )
)
