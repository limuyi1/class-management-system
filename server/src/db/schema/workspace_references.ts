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

/** workspace_references 的完整结构描述；修改 SQL 后须同步并执行 schema 一致性测试。 */
export const workspace_references = registerSchema(
  'workspace_references',
  sqliteTable(
    'workspace_references',
    {
      workspaceId: text('workspaceId').notNull(),
      ownerId: text('ownerId').notNull(),
      sourceWorkspaceId: text('sourceWorkspaceId').notNull(),
      assessmentId: text('assessmentId').notNull(),
      sortIndex: integer('sortIndex').notNull()
    },
    (table) => [
      primaryKey({ columns: [table.workspaceId, table.assessmentId] }),
      index('references_source').on(table.assessmentId),
      foreignKey({
        columns: [table.assessmentId, table.sourceWorkspaceId, table.ownerId],
        foreignColumns: [
          schemaColumn('assessments', 'id'),
          schemaColumn('assessments', 'workspaceId'),
          schemaColumn('assessments', 'ownerId')
        ]
      })
        .onUpdate('no action')
        .onDelete('no action'),
      foreignKey({
        columns: [table.workspaceId, table.ownerId],
        foreignColumns: [schemaColumn('workspaces', 'id'), schemaColumn('workspaces', 'ownerId')]
      })
        .onUpdate('no action')
        .onDelete('no action'),
      check('workspace_references_check_0', sql.raw('workspaceId != sourceWorkspaceId'))
    ]
  )
)
