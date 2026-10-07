import { integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { registerSchema } from './registry.js'

/** mutation_receipts 的完整结构描述；修改 SQL 后须同步并执行 schema 一致性测试。 */
export const mutation_receipts = registerSchema(
  'mutation_receipts',
  sqliteTable(
    'mutation_receipts',
    {
      actorId: text('actorId').notNull(),
      ownerId: text('ownerId').notNull(),
      key: text('key').notNull(),
      requestHash: text('requestHash').notNull(),
      resultJson: text('resultJson').notNull(),
      createdAt: integer('createdAt').notNull()
    },
    (table) => [primaryKey({ columns: [table.actorId, table.ownerId, table.key] })]
  )
)
