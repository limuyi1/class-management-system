import { sql } from 'drizzle-orm'
import {
  check,
  foreignKey,
  index,
  integer,
  primaryKey,
  sqliteTable,
  text
} from 'drizzle-orm/sqlite-core'
import { registerSchema, schemaColumn } from './registry.js'

/** classroom_tools 的完整结构描述；修改 SQL 后须同步并执行 schema 一致性测试。 */
export const classroom_tools = registerSchema(
  'classroom_tools',
  sqliteTable(
    'classroom_tools',
    {
      id: text('id'),
      workspaceId: text('workspaceId').notNull(),
      ownerId: text('ownerId').notNull(),
      kind: text('kind').notNull(),
      contentJson: text('contentJson').notNull(),
      version: integer('version').notNull().default(sql.raw('1')),
      createdAt: integer('createdAt').notNull(),
      updatedAt: integer('updatedAt').notNull(),
      deletedAt: integer('deletedAt')
    },
    (table) => [
      primaryKey({ columns: [table.id] }),
      index('classroom_tools_scope').on(table.ownerId, table.workspaceId, table.deletedAt),
      foreignKey({
        columns: [table.workspaceId, table.ownerId],
        foreignColumns: [schemaColumn('workspaces', 'id'), schemaColumn('workspaces', 'ownerId')]
      })
        .onUpdate('no action')
        .onDelete('no action'),
      check('classroom_tools_check_0', sql.raw("kind IN ('seating','duty')"))
    ]
  )
)
