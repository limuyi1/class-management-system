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

/** attachments 的完整结构描述；修改 SQL 后须同步并执行 schema 一致性测试。 */
export const attachments = registerSchema(
  'attachments',
  sqliteTable(
    'attachments',
    {
      id: text('id'),
      ownerId: text('ownerId').notNull(),
      name: text('name').notNull(),
      mimeType: text('mimeType').notNull(),
      size: integer('size').notNull(),
      width: integer('width').notNull(),
      height: integer('height').notNull(),
      hash: text('hash').notNull(),
      version: integer('version').notNull().default(sql.raw('1')),
      createdAt: integer('createdAt').notNull(),
      updatedAt: integer('updatedAt').notNull(),
      deletedAt: integer('deletedAt'),
      sortIndex: integer('sortIndex').notNull().default(sql.raw('0'))
    },
    (table) => [
      primaryKey({ columns: [table.id] }),
      index('attachments_order').on(table.ownerId, table.deletedAt, table.sortIndex),
      index('attachments_scope').on(table.ownerId, table.deletedAt, table.createdAt, table.id),
      foreignKey({ columns: [table.ownerId], foreignColumns: [schemaColumn('users', 'id')] })
        .onUpdate('no action')
        .onDelete('no action'),
      check('attachments_check_0', sql.raw("mimeType IN ('image/png','image/jpeg')"))
    ]
  )
)
