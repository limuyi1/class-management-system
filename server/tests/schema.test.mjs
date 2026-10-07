import { test } from 'node:test'
import assert from 'node:assert/strict'
import { getTableConfig } from 'drizzle-orm/sqlite-core'
import * as schema from '../dist/db/schema.js'
import { fixture } from './helpers/scores.mjs'
/** 实际迁移与 ORM 描述一致，防止后续生成两套不相容结构。 */
test('全量 Drizzle 表、字段、主键和外键与 SQL 迁移一致', () => {
  const f = fixture()
  try {
    const tables = f.db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
      .all()
      .map((row) => row.name)
      .sort()
    assert.deepEqual(Object.keys(schema).sort(), tables)
    for (const [name, table] of Object.entries(schema)) {
      const config = getTableConfig(table)
      const actual = f.db.prepare(`PRAGMA table_info(${name})`).all()
      assert.deepEqual(
        config.columns.map((col) => col.name),
        actual.map((col) => col.name),
        name
      )
      assert.deepEqual(
        config.primaryKeys.flatMap((key) => key.columns.map((col) => col.name)),
        actual
          .filter((col) => col.pk)
          .sort((a, b) => a.pk - b.pk)
          .map((col) => col.name),
        name
      )
      const foreign = f.db.prepare(`PRAGMA foreign_key_list(${name})`).all()
      assert.equal(config.foreignKeys.length, new Set(foreign.map((row) => row.id)).size, name)
      for (const key of config.foreignKeys) assert.ok(key.reference().foreignColumns.length, name)
      for (const col of config.columns)
        assert.equal(
          col.notNull,
          Boolean(actual.find((row) => row.name === col.name).notnull),
          `${name}.${col.name}`
        )
    }
  } finally {
    f.db.close()
  }
})
