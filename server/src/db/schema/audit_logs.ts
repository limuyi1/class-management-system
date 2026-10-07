import { integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { registerSchema } from './registry.js'

/** audit_logs 的完整结构描述；修改 SQL 后须同步并执行 schema 一致性测试。 */
export const audit_logs = registerSchema(
  'audit_logs',
  sqliteTable(
    'audit_logs',
    {
      id: text('id'),
      actorId: text('actorId').notNull(),
      ownerId: text('ownerId').notNull(),
      action: text('action').notNull(),
      resourceId: text('resourceId').notNull(),
      requestId: text('requestId').notNull(),
      createdAt: integer('createdAt').notNull()
    },
    (table) => [primaryKey({ columns: [table.id] })]
  )
)
