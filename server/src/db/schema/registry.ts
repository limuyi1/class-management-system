import type { AnySQLiteColumn, SQLiteTable } from 'drizzle-orm/sqlite-core'

const tables = new Map<string, SQLiteTable>()
/** 延迟解析跨表外键，避免循环导入；必须先加载 schema 总入口。 */
export function schemaColumn(table: string, column: string): AnySQLiteColumn {
  const value = tables.get(table) as unknown as Record<string, AnySQLiteColumn> | undefined
  if (!value?.[column]) throw new Error(`schema 外键缺失：${table}.${column}`)
  return value[column]!
}
/** 注册描述对象；SQL 迁移仍是唯一的建表来源。 */
export function registerSchema<T extends SQLiteTable>(name: string, table: T): T {
  tables.set(name, table)
  return table
}
