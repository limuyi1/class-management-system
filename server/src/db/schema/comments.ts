import { sql } from 'drizzle-orm'
import { foreignKey, index, integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { registerSchema, schemaColumn } from './registry.js'

/** comments 的完整结构描述；修改 SQL 后须同步并执行 schema 一致性测试。 */
export const comments = registerSchema(
  'comments',
  sqliteTable(
    'comments',
    {
      workspaceId: text('workspaceId').notNull(),
      ownerId: text('ownerId').notNull(),
      studentId: text('studentId').notNull(),
      text: text('text').notNull().default(sql.raw("''")),
      version: integer('version').notNull().default(sql.raw('1')),
      deletedAt: integer('deletedAt')
    },
    (table) => [
      primaryKey({ columns: [table.workspaceId, table.studentId] }),
      index('comments_scope').on(table.ownerId, table.workspaceId),
      foreignKey({
        columns: [table.workspaceId, table.ownerId, table.studentId],
        foreignColumns: [
          schemaColumn('enrollments', 'workspaceId'),
          schemaColumn('enrollments', 'ownerId'),
          schemaColumn('enrollments', 'studentId')
        ]
      })
        .onUpdate('no action')
        .onDelete('no action')
    ]
  )
)
