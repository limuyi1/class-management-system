import { integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { registerSchema } from './registry.js'

/** login_limits 的完整结构描述；修改 SQL 后须同步并执行 schema 一致性测试。 */
export const login_limits = registerSchema(
  'login_limits',
  sqliteTable(
    'login_limits',
    {
      key: text('key'),
      count: integer('count').notNull(),
      resetsAt: integer('resetsAt').notNull()
    },
    (table) => [primaryKey({ columns: [table.key] })]
  )
)
