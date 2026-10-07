import { sql } from 'drizzle-orm'
import { foreignKey, integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { registerSchema, schemaColumn } from './registry.js'

/** 代管授权绑定真实设备，SQL 迁移与 ORM 字段保持一致。 */
export const managed_sessions = registerSchema(
  'managed_sessions',
  sqliteTable(
    'managed_sessions',
    {
      id: text('id'),
      sessionId: text('sessionId').notNull(),
      actorId: text('actorId').notNull(),
      ownerId: text('ownerId').notNull(),
      ownerAuthVersion: integer('ownerAuthVersion').notNull(),
      expiresAt: integer('expiresAt').notNull(),
      revoked: integer('revoked').notNull().default(sql.raw('0')),
      createdAt: integer('createdAt').notNull()
    },
    (table) => [
      primaryKey({ columns: [table.id] }),
      foreignKey({
        columns: [table.sessionId],
        foreignColumns: [schemaColumn('auth_sessions', 'id')]
      }),
      foreignKey({ columns: [table.actorId], foreignColumns: [schemaColumn('users', 'id')] }),
      foreignKey({ columns: [table.ownerId], foreignColumns: [schemaColumn('users', 'id')] })
    ]
  )
)
