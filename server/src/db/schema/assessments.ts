import { sql } from 'drizzle-orm'
import {
  check,
  foreignKey,
  index,
  integer,
  primaryKey,
  real,
  sqliteTable,
  text,
  unique
} from 'drizzle-orm/sqlite-core'
import { registerSchema, schemaColumn } from './registry.js'

/** assessments 的完整结构描述；修改 SQL 后须同步并执行 schema 一致性测试。 */
export const assessments = registerSchema(
  'assessments',
  sqliteTable(
    'assessments',
    {
      id: text('id'),
      workspaceId: text('workspaceId').notNull(),
      ownerId: text('ownerId').notNull(),
      prop: text('prop').notNull(),
      label: text('label').notNull(),
      sortIndex: integer('sortIndex').notNull(),
      disabled: integer('disabled').notNull().default(sql.raw('0')),
      fullMark: real('fullMark'),
      version: integer('version').notNull().default(sql.raw('1')),
      deletedAt: integer('deletedAt')
    },
    (table) => [
      primaryKey({ columns: [table.id] }),
      index('assessments_scope').on(table.ownerId, table.workspaceId, table.deletedAt),
      unique().on(table.id, table.workspaceId, table.ownerId),
      unique().on(table.workspaceId, table.prop),
      foreignKey({
        columns: [table.workspaceId, table.ownerId],
        foreignColumns: [schemaColumn('workspaces', 'id'), schemaColumn('workspaces', 'ownerId')]
      })
        .onUpdate('no action')
        .onDelete('no action'),
      check('assessments_check_0', sql.raw('disabled IN (0,1)')),
      check('assessments_check_1', sql.raw('fullMark IS NULL OR fullMark > 0'))
    ]
  )
)
