import { sql } from 'drizzle-orm'
import { check, foreignKey, integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { registerSchema, schemaColumn } from './registry.js'

/** business_resources 的完整结构描述；修改 SQL 后须同步并执行 schema 一致性测试。 */
export const business_resources = registerSchema(
  'business_resources',
  sqliteTable(
    'business_resources',
    {
      ownerId: text('ownerId').notNull(),
      kind: text('kind').notNull(),
      id: text('id').notNull(),
      workspaceId: text('workspaceId'),
      name: text('name').notNull(),
      contentJson: text('contentJson').notNull(),
      version: integer('version').notNull().default(sql.raw('1')),
      deletedAt: integer('deletedAt'),
      updatedAt: integer('updatedAt').notNull()
    },
    (table) => [
      primaryKey({ columns: [table.ownerId, table.kind, table.id] }),
      foreignKey({
        columns: [table.workspaceId, table.ownerId],
        foreignColumns: [schemaColumn('workspaces', 'id'), schemaColumn('workspaces', 'ownerId')]
      })
        .onUpdate('no action')
        .onDelete('no action'),
      foreignKey({ columns: [table.ownerId], foreignColumns: [schemaColumn('users', 'id')] })
        .onUpdate('no action')
        .onDelete('no action'),
      check('business_resources_check_0', sql.raw("kind IN ('paper','tags','settings')"))
    ]
  )
)
