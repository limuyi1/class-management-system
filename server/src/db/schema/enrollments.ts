import { sql } from 'drizzle-orm'
import {
  check,
  foreignKey,
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex
} from 'drizzle-orm/sqlite-core'
import { registerSchema, schemaColumn } from './registry.js'

/** enrollments 的完整结构描述；修改 SQL 后须同步并执行 schema 一致性测试。 */
export const enrollments = registerSchema(
  'enrollments',
  sqliteTable(
    'enrollments',
    {
      workspaceId: text('workspaceId').notNull(),
      ownerId: text('ownerId').notNull(),
      studentId: text('studentId').notNull(),
      name: text('name').notNull(),
      disabled: integer('disabled').notNull().default(sql.raw('0')),
      departed: integer('departed').notNull().default(sql.raw('0')),
      departedAt: integer('departedAt'),
      deletedAt: integer('deletedAt'),
      sortIndex: integer('sortIndex').notNull(),
      version: integer('version').notNull().default(sql.raw('1'))
    },
    (table) => [
      primaryKey({ columns: [table.workspaceId, table.studentId] }),
      uniqueIndex('enrollments_identity').on(table.workspaceId, table.ownerId, table.studentId),
      index('enrollments_owner').on(table.ownerId, table.workspaceId),
      foreignKey({
        columns: [table.ownerId, table.studentId],
        foreignColumns: [schemaColumn('students', 'ownerId'), schemaColumn('students', 'id')]
      })
        .onUpdate('no action')
        .onDelete('no action'),
      foreignKey({
        columns: [table.workspaceId, table.ownerId],
        foreignColumns: [schemaColumn('workspaces', 'id'), schemaColumn('workspaces', 'ownerId')]
      })
        .onUpdate('no action')
        .onDelete('cascade'),
      check('enrollments_check_0', sql.raw('disabled IN (0,1)')),
      check('enrollments_check_1', sql.raw('departed IN (0,1)'))
    ]
  )
)
