/** 内存数据库验证，不操作用户数据或监听端口。 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import SQLite from 'better-sqlite3'
import { readFileSync } from 'node:fs'
import { migrate, SCHEMA_VERSION } from '../dist/db/migrate.js'
import { buildApp } from '../dist/app.js'
import { fixture } from './helpers/scores.mjs'

test('HTTP 成绩批次拒绝额外字段、跨账号与历史写入，返回脱敏冲突明细', async () => {
  const f = fixture()
  const app = await buildApp(f.db, 'http://127.0.0.1:5173')
  try {
    const student = f.student('甲'),
      column = f.assessment(),
      other = f.actor(),
      admin = f.actor('ADMIN')
    const headers = { authorization: `Bearer ${f.context.token}`, 'idempotency-key': randomUUID() }
    const change = {
      studentId: student.studentId,
      assessmentId: column.id,
      value: 0,
      expectedVersion: 0
    }
    const url = `/api/v1/workspaces/${f.workspace.id}/scores/batch`
    const invalid = await app.inject({
      method: 'PATCH',
      url,
      headers,
      payload: { items: [{ ...change, ownerId: other.ownerId }] }
    })
    assert.equal(invalid.statusCode, 400)
    const response = await app.inject({
      method: 'PATCH',
      url,
      headers,
      payload: { items: [change] }
    })
    assert.equal(response.statusCode, 200)
    const conflict = await app.inject({
      method: 'PATCH',
      url,
      headers: { ...headers, 'idempotency-key': randomUUID() },
      payload: { items: [{ ...change, value: 99 }] }
    })
    assert.equal(conflict.statusCode, 409)
    assert.deepEqual(conflict.json().details.conflicts[0].current, {
      studentId: student.studentId,
      assessmentId: column.id,
      value: 0,
      version: 1
    })
    const cross = await app.inject({
      method: 'GET',
      url: `/api/v1/workspaces/${f.workspace.id}/scores`,
      headers: { authorization: `Bearer ${other.token}` }
    })
    assert.equal(cross.statusCode, 404)
    f.db.prepare('UPDATE users SET superVip=1 WHERE id=?').run(admin.ownerId)
    const managed = {
      authorization: `Bearer ${admin.token}`,
      'x-managed-account-id': f.context.ownerId,
      'idempotency-key': randomUUID()
    }
    const edit = await app.inject({
      method: 'PATCH',
      url,
      headers: managed,
      payload: { items: [{ ...change, value: 20, expectedVersion: 1 }] }
    })
    assert.equal(edit.statusCode, 200)
    const audit = f.db
      .prepare(
        "SELECT actorId,ownerId FROM audit_logs WHERE action='SCORES_BATCH' ORDER BY rowid DESC LIMIT 1"
      )
      .get()
    assert.deepEqual(audit, { actorId: admin.ownerId, ownerId: f.context.ownerId })
    const fresh = await app.inject({
      method: 'GET',
      url: `/api/v1/workspaces/${f.workspace.id}/scores`,
      headers: managed
    })
    assert.equal(fresh.json().scores[0].value, 20)
  } finally {
    await app.close()
    f.db.close()
  }
})

test('schema v2 增量升级保留既有账号、班级和名单，不初始化或清空教学数据', () => {
  const db = new SQLite(':memory:')
  try {
    db.exec(readFileSync(new URL('../migrations/001-auth.sql', import.meta.url), 'utf8'))
    db.exec(readFileSync(new URL('../migrations/002-workspaces.sql', import.meta.url), 'utf8'))
    db.exec(`PRAGMA user_version=2;
      INSERT INTO users(id,phone,nickname,passwordHash,role,status,createdAt) VALUES('owner','13800000000','老师','hash','USER','ACTIVE',0);
      INSERT INTO classes VALUES('class','owner',0);
      INSERT INTO workspaces(id,ownerId,classId,className,termName,createdAt,updatedAt) VALUES('period','owner','class','303','上学期',0,0);
      INSERT INTO students VALUES('owner','student',0);
      INSERT INTO enrollments(workspaceId,ownerId,studentId,name,sortIndex) VALUES('period','owner','student','原有学生',0);`)
    migrate(db)
    migrate(db)
    assert.equal(db.pragma('user_version', { simple: true }), SCHEMA_VERSION)
    assert.equal(db.prepare('SELECT name FROM enrollments').get().name, '原有学生')
    assert.equal(db.prepare('SELECT count(*) AS count FROM scores').get().count, 0)
    assert.equal(db.prepare('SELECT className FROM workspaces').get().className, '303')
  } finally {
    db.close()
  }
})
