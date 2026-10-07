import { foreignKey, integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { registerSchema, schemaColumn } from './registry.js'

/** import_previews 的完整结构描述；修改 SQL 后须同步并执行 schema 一致性测试。 */
export const import_previews = registerSchema(
  'import_previews',
  sqliteTable(
    'import_previews',
    {
      id: text('id'),
      actorId: text('actorId').notNull(),
      ownerId: text('ownerId').notNull(),
      workspaceId: text('workspaceId').notNull(),
      contentJson: text('contentJson').notNull(),
      expiresAt: integer('expiresAt').notNull()
    },
    (table) => [
      primaryKey({ columns: [table.id] }),
      foreignKey({
        columns: [table.workspaceId, table.ownerId],
        foreignColumns: [schemaColumn('workspaces', 'id'), schemaColumn('workspaces', 'ownerId')]
      })
        .onUpdate('no action')
        .onDelete('no action'),
      foreignKey({ columns: [table.ownerId], foreignColumns: [schemaColumn('users', 'id')] })
        .onUpdate('no action')
        .onDelete('no action'),
      foreignKey({ columns: [table.actorId], foreignColumns: [schemaColumn('users', 'id')] })
        .onUpdate('no action')
        .onDelete('no action')
    ]
  )
)
