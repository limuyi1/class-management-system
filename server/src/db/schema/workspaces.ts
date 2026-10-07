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

/** workspaces 的完整结构描述；修改 SQL 后须同步并执行 schema 一致性测试。 */
export const workspaces = registerSchema(
  'workspaces',
  sqliteTable(
    'workspaces',
    {
      id: text('id'),
      ownerId: text('ownerId').notNull(),
      classId: text('classId').notNull(),
      className: text('className').notNull(),
      termName: text('termName').notNull(),
      scoreFullMark: real('scoreFullMark').notNull().default(sql.raw('100')),
      version: integer('version').notNull().default(sql.raw('1')),
      createdAt: integer('createdAt').notNull(),
      updatedAt: integer('updatedAt').notNull(),
      deletedAt: integer('deletedAt')
    },
    (table) => [
      primaryKey({ columns: [table.id] }),
      index('workspaces_owner').on(table.ownerId, table.updatedAt),
      unique().on(table.ownerId, table.className, table.termName),
      unique().on(table.classId, table.termName),
      unique().on(table.id, table.ownerId),
      foreignKey({
        columns: [table.classId, table.ownerId],
        foreignColumns: [schemaColumn('classes', 'id'), schemaColumn('classes', 'ownerId')]
      })
        .onUpdate('no action')
        .onDelete('no action'),
      foreignKey({ columns: [table.ownerId], foreignColumns: [schemaColumn('users', 'id')] })
        .onUpdate('no action')
        .onDelete('no action'),
      check('workspaces_check_0', sql.raw('scoreFullMark > 0'))
    ]
  )
)
