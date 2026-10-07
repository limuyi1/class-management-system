import { foreignKey, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { registerSchema, schemaColumn } from './registry.js'

/** paper_files 的完整结构描述；修改 SQL 后须同步并执行 schema 一致性测试。 */
export const paper_files = registerSchema(
  'paper_files',
  sqliteTable(
    'paper_files',
    {
      ownerId: text('ownerId').notNull(),
      paperId: text('paperId').notNull(),
      itemId: text('itemId').notNull(),
      hash: text('hash').notNull(),
      mimeType: text('mimeType').notNull()
    },
    (table) => [
      primaryKey({ columns: [table.ownerId, table.paperId, table.itemId] }),
      foreignKey({
        columns: [table.ownerId, table.hash],
        foreignColumns: [
          schemaColumn('attachment_blobs', 'ownerId'),
          schemaColumn('attachment_blobs', 'hash')
        ]
      })
        .onUpdate('no action')
        .onDelete('no action')
    ]
  )
)
