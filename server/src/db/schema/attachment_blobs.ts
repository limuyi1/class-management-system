import { foreignKey, integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { registerSchema, schemaColumn } from './registry.js'

/** attachment_blobs 的完整结构描述；修改 SQL 后须同步并执行 schema 一致性测试。 */
export const attachment_blobs = registerSchema(
  'attachment_blobs',
  sqliteTable(
    'attachment_blobs',
    {
      ownerId: text('ownerId').notNull(),
      hash: text('hash').notNull(),
      size: integer('size').notNull(),
      createdAt: integer('createdAt').notNull()
    },
    (table) => [
      primaryKey({ columns: [table.ownerId, table.hash] }),
      foreignKey({ columns: [table.ownerId], foreignColumns: [schemaColumn('users', 'id')] })
        .onUpdate('no action')
        .onDelete('no action')
    ]
  )
)
