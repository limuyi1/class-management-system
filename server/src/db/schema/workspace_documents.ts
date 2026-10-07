import { sql } from 'drizzle-orm'
import { foreignKey, integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { registerSchema, schemaColumn } from './registry.js'

/** workspace_documents 的完整结构描述；修改 SQL 后须同步并执行 schema 一致性测试。 */
export const workspace_documents = registerSchema(
  'workspace_documents',
  sqliteTable(
    'workspace_documents',
    {
      workspaceId: text('workspaceId').notNull(),
      ownerId: text('ownerId').notNull(),
      type: text('type').notNull(),
      contentJson: text('contentJson').notNull(),
      version: integer('version').notNull().default(sql.raw('1')),
      updatedAt: integer('updatedAt').notNull()
    },
    (table) => [
      primaryKey({ columns: [table.workspaceId, table.type] }),
      foreignKey({
        columns: [table.workspaceId, table.ownerId],
        foreignColumns: [schemaColumn('workspaces', 'id'), schemaColumn('workspaces', 'ownerId')]
      })
        .onUpdate('no action')
        .onDelete('no action')
    ]
  )
)
