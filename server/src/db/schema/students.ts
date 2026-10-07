import { foreignKey, integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { registerSchema, schemaColumn } from './registry.js'

/** students 的完整结构描述；修改 SQL 后须同步并执行 schema 一致性测试。 */
export const students = registerSchema(
  'students',
  sqliteTable(
    'students',
    {
      ownerId: text('ownerId').notNull(),
      id: text('id').notNull(),
      createdAt: integer('createdAt').notNull()
    },
    (table) => [
      primaryKey({ columns: [table.ownerId, table.id] }),
      foreignKey({ columns: [table.ownerId], foreignColumns: [schemaColumn('users', 'id')] })
        .onUpdate('no action')
        .onDelete('no action')
    ]
  )
)
