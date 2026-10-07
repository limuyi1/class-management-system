import { sql } from 'drizzle-orm'
import { integer, primaryKey, sqliteTable, text, unique } from 'drizzle-orm/sqlite-core'
import { registerSchema } from './registry.js'

/** captcha_challenges 的完整结构描述；修改 SQL 后须同步并执行 schema 一致性测试。 */
export const captcha_challenges = registerSchema(
  'captcha_challenges',
  sqliteTable(
    'captcha_challenges',
    {
      id: text('id'),
      intent: text('intent').notNull(),
      answer: integer('answer').notNull(),
      expiresAt: integer('expiresAt').notNull(),
      attempts: integer('attempts').notNull().default(sql.raw('0')),
      consumed: integer('consumed').notNull().default(sql.raw('0')),
      ticketHash: text('ticketHash')
    },
    (table) => [primaryKey({ columns: [table.id] }), unique().on(table.ticketHash)]
  )
)
