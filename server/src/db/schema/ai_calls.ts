import { sql } from 'drizzle-orm'
import {
  check,
  foreignKey,
  integer,
  primaryKey,
  sqliteTable,
  text,
  unique
} from 'drizzle-orm/sqlite-core'
import { registerSchema, schemaColumn } from './registry.js'

/** ai_calls 的完整结构描述；修改 SQL 后须同步并执行 schema 一致性测试。 */
export const ai_calls = registerSchema(
  'ai_calls',
  sqliteTable(
    'ai_calls',
    {
      id: text('id'),
      actorId: text('actorId').notNull(),
      ownerId: text('ownerId').notNull(),
      workspaceId: text('workspaceId'),
      requestKey: text('requestKey').notNull(),
      requestHash: text('requestHash').notNull(),
      mode: text('mode').notNull(),
      status: text('status').notNull(),
      resultJson: text('resultJson'),
      inputTokens: integer('inputTokens'),
      outputTokens: integer('outputTokens'),
      createdAt: integer('createdAt').notNull()
    },
    (table) => [
      primaryKey({ columns: [table.id] }),
      unique().on(table.actorId, table.ownerId, table.requestKey),
      foreignKey({ columns: [table.ownerId], foreignColumns: [schemaColumn('users', 'id')] })
        .onUpdate('no action')
        .onDelete('no action'),
      foreignKey({ columns: [table.actorId], foreignColumns: [schemaColumn('users', 'id')] })
        .onUpdate('no action')
        .onDelete('no action'),
      check('ai_calls_check_0', sql.raw("status IN ('RUNNING','DONE','FAILED','UNCERTAIN')"))
    ]
  )
)
