import { sql } from 'drizzle-orm'
import {
  foreignKey,
  index,
  integer,
  primaryKey,
  real,
  sqliteTable,
  text
} from 'drizzle-orm/sqlite-core'
import { registerSchema, schemaColumn } from './registry.js'

/** scores 的完整结构描述；修改 SQL 后须同步并执行 schema 一致性测试。 */
export const scores = registerSchema(
  'scores',
  sqliteTable(
    'scores',
    {
      workspaceId: text('workspaceId').notNull(),
      ownerId: text('ownerId').notNull(),
      studentId: text('studentId').notNull(),
      assessmentId: text('assessmentId').notNull(),
      value: real('value'),
      version: integer('version').notNull().default(sql.raw('1'))
    },
    (table) => [
      primaryKey({ columns: [table.workspaceId, table.studentId, table.assessmentId] }),
      index('scores_scope').on(table.ownerId, table.workspaceId, table.assessmentId),
      foreignKey({
        columns: [table.assessmentId, table.workspaceId, table.ownerId],
        foreignColumns: [
          schemaColumn('assessments', 'id'),
          schemaColumn('assessments', 'workspaceId'),
          schemaColumn('assessments', 'ownerId')
        ]
      })
        .onUpdate('no action')
        .onDelete('no action'),
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
