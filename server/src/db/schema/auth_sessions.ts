import { sql } from 'drizzle-orm'
import { foreignKey, integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { registerSchema, schemaColumn } from './registry.js'

/** auth_sessions 的完整结构描述；修改 SQL 后须同步并执行 schema 一致性测试。 */
export const auth_sessions = registerSchema(
  'auth_sessions',
  sqliteTable(
    'auth_sessions',
    {
      id: text('id'),
      userId: text('userId').notNull(),
      authVersion: integer('authVersion').notNull(),
      expiresAt: integer('expiresAt').notNull(),
      revoked: integer('revoked').notNull().default(sql.raw('0')),
      createdAt: integer('createdAt').notNull(),
      client: text('client').notNull()
    },
    (table) => [
      primaryKey({ columns: [table.id] }),
      foreignKey({ columns: [table.userId], foreignColumns: [schemaColumn('users', 'id')] })
        .onUpdate('no action')
        .onDelete('no action')
    ]
  )
)
