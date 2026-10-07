import { sql } from 'drizzle-orm'
import {
  check,
  foreignKey,
  index,
  integer,
  primaryKey,
  sqliteTable,
  text
} from 'drizzle-orm/sqlite-core'
import { registerSchema, schemaColumn } from './registry.js'

/** auth_tokens 的完整结构描述；修改 SQL 后须同步并执行 schema 一致性测试。 */
export const auth_tokens = registerSchema(
  'auth_tokens',
  sqliteTable(
    'auth_tokens',
    {
      hash: text('hash'),
      sessionId: text('sessionId').notNull(),
      kind: text('kind').notNull(),
      expiresAt: integer('expiresAt').notNull(),
      consumed: integer('consumed').notNull().default(sql.raw('0'))
    },
    (table) => [
      primaryKey({ columns: [table.hash] }),
      index('tokens_session').on(table.sessionId),
      foreignKey({
        columns: [table.sessionId],
        foreignColumns: [schemaColumn('auth_sessions', 'id')]
      })
        .onUpdate('no action')
        .onDelete('no action'),
      check('auth_tokens_check_0', sql.raw("kind IN ('ACCESS','REFRESH')"))
    ]
  )
)
