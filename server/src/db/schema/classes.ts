import { foreignKey, integer, primaryKey, sqliteTable, text, unique } from 'drizzle-orm/sqlite-core'
import { registerSchema, schemaColumn } from './registry.js'

/** classes 的完整结构描述；修改 SQL 后须同步并执行 schema 一致性测试。 */
export const classes = registerSchema(
  'classes',
  sqliteTable(
    'classes',
    {
      id: text('id'),
      ownerId: text('ownerId').notNull(),
      createdAt: integer('createdAt').notNull()
    },
    (table) => [
      primaryKey({ columns: [table.id] }),
      unique().on(table.id, table.ownerId),
      foreignKey({ columns: [table.ownerId], foreignColumns: [schemaColumn('users', 'id')] })
        .onUpdate('no action')
        .onDelete('no action')
    ]
  )
)
