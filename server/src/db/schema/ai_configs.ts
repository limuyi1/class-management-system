import { sql } from 'drizzle-orm'
import {
  check,
  foreignKey,
  integer,
  primaryKey,
  sqliteTable,
  text,
  unique
} from 'drizzle-orm/sqlite-core'
import { registerSchema, schemaColumn } from './registry.js'

/** ai_configs 的完整结构描述；修改 SQL 后须同步并执行 schema 一致性测试。 */
export const ai_configs = registerSchema(
  'ai_configs',
  sqliteTable(
    'ai_configs',
    {
      id: text('id'),
      ownerId: text('ownerId'),
      provider: text('provider').notNull(),
      baseUrl: text('baseUrl').notNull(),
      model: text('model').notNull(),
      secret: text('secret'),
      enabled: integer('enabled').notNull(),
      version: integer('version').notNull().default(sql.raw('1')),
      updatedAt: integer('updatedAt').notNull()
    },
    (table) => [
      primaryKey({ columns: [table.id] }),
      unique().on(table.ownerId),
      foreignKey({ columns: [table.ownerId], foreignColumns: [schemaColumn('users', 'id')] })
        .onUpdate('no action')
        .onDelete('no action'),
      check('ai_configs_check_0', sql.raw("provider IN ('OPENAI','GEMINI')")),
      check('ai_configs_check_1', sql.raw('enabled IN (0,1)')),
      check('ai_configs_check_2', sql.raw("(id='platform' AND ownerId IS NULL) OR id=ownerId"))
    ]
  )
)
