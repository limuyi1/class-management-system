import { sql } from 'drizzle-orm'
import { check, integer, primaryKey, sqliteTable, text, unique } from 'drizzle-orm/sqlite-core'
import { registerSchema } from './registry.js'

/** users 的完整结构描述；修改 SQL 后须同步并执行 schema 一致性测试。 */
export const users = registerSchema(
  'users',
  sqliteTable(
    'users',
    {
      id: text('id'),
      phone: text('phone').notNull(),
      nickname: text('nickname').notNull(),
      passwordHash: text('passwordHash').notNull(),
      role: text('role').notNull(),
      status: text('status').notNull(),
      superVip: integer('superVip').notNull().default(sql.raw('0')),
      mustChangePassword: integer('mustChangePassword').notNull().default(sql.raw('1')),
      authVersion: integer('authVersion').notNull().default(sql.raw('1')),
      version: integer('version').notNull().default(sql.raw('1')),
      createdAt: integer('createdAt').notNull()
    },
    (table) => [
      primaryKey({ columns: [table.id] }),
      unique().on(table.phone),
      check('users_check_0', sql.raw("role IN ('ADMIN','USER')")),
      check('users_check_1', sql.raw("status IN ('ACTIVE','DISABLED','DELETED')")),
      check('users_check_2', sql.raw('superVip IN (0,1)')),
      check('users_check_3', sql.raw("role='ADMIN' OR superVip=0")),
      check('users_check_4', sql.raw("role!='ADMIN' OR status='ACTIVE'"))
    ]
  )
)
