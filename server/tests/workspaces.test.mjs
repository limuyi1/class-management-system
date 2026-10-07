import { test } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import SQLite from 'better-sqlite3'

import { migrate, SCHEMA_VERSION } from '../dist/db/migrate.js'
import { createSession, authenticate } from '../dist/auth/tokens.js'
import { resolveOwner } from '../dist/policies/access.js'
import { createWorkspace, editWorkspace, listWorkspaces } from '../dist/services/workspaces.js'
import {
  addStudent,
  editStudent,
  deleteStudent,
  listEnrollments
} from '../dist/services/students.js'
import { promoteWorkspace, transferStudent } from '../dist/services/rosterLifecycle.js'

function fixture() {
  const db = new SQLite(':memory:')
  migrate(db)
  function actor(role = 'USER', vip = 0) {
    const id = randomUUID()
    db.prepare(
      `INSERT INTO users(id,phone,nickname,passwordHash,role,status,superVip,mustChangePassword,createdAt)
      VALUES(?,?,?,?,?,'ACTIVE',?,0,?)`
    ).run(
      id,
      `138${String(Math.floor(Math.random() * 1e8)).padStart(8, '0')}`,
      '测试老师',
      'hash',
      role,
      vip,
      Date.now()
    )
    const account = db.prepare('SELECT * FROM users WHERE id=?').get(id)
    const session = authenticate(db, createSession(db, account).accessToken)
    return { actor: session, ownerId: id, sessionId: session.sessionId }
  }
  const workspace = (context, name, term = '2026上') =>
    createWorkspace(db, context, { className: name, termName: term }, randomUUID(), 'test')
  return { db, actor, workspace }
}

test('业务按账号隔离，数据库拒绝跨账号班级和学生外键', () => {
  const f = fixture()
  try {
    const one = f.actor(),
      two = f.actor(),
      admin = f.actor('ADMIN', 1)
    const first = f.workspace(one, '303'),
      second = f.workspace(two, '303')
    assert.equal(listWorkspaces(f.db, one).length, 1)
    assert.throws(() => listEnrollments(f.db, one.ownerId, second.id), /不存在/)
    assert.throws(() => resolveOwner(f.db, one.actor, two.ownerId), /无权/)
    const managed = { ...admin, ownerId: two.ownerId }
    assert.equal(listWorkspaces(f.db, managed)[0].id, second.id)
    addStudent(f.db, managed, second.id, { name: '代管学生' }, randomUUID(), 'managed')
    assert.equal(listEnrollments(f.db, two.ownerId, second.id).length, 1)
    assert.equal(listEnrollments(f.db, one.ownerId, first.id).length, 0)
    assert.throws(
      () =>
        f.db
          .prepare(
            'INSERT INTO enrollments(workspaceId,ownerId,studentId,name,sortIndex) VALUES(?,?,?,?,1)'
          )
          .run(first.id, two.ownerId, randomUUID(), '越权'),
      /FOREIGN KEY/
    )
    f.db.prepare('UPDATE users SET superVip=0 WHERE id=?').run(admin.actor.id)
    assert.throws(
      () => addStudent(f.db, managed, second.id, { name: '权限已关闭' }, randomUUID(), 'closed'),
      /无权/
    )
  } finally {
    f.db.close()
  }
})

test('同名不合并，新学期沿用 ID 和禁用状态、过滤转出，修改不改写往期', () => {
  const f = fixture()
  try {
    const context = f.actor(),
      source = f.workspace(context, '303')
    const one = addStudent(f.db, context, source.id, { name: '同名' }, randomUUID(), 'one')
    const two = addStudent(f.db, context, source.id, { name: '同名' }, randomUUID(), 'two')
    assert.notEqual(one.studentId, two.studentId)
    editStudent(
      f.db,
      context,
      source.id,
      one.studentId,
      { ...one, disabled: true, departed: false },
      randomUUID(),
      'disable'
    )
    editStudent(
      f.db,
      context,
      source.id,
      two.studentId,
      { ...two, departed: true, disabled: false },
      randomUUID(),
      'depart'
    )
    const latest = listWorkspaces(f.db, context)[0]
    const promoted = promoteWorkspace(
      f.db,
      context,
      source.id,
      { className: '403', termName: '2026下', inheritStudents: true, version: latest.version },
      randomUUID(),
      'promote'
    )
    const current = listEnrollments(f.db, context.ownerId, promoted.id)
    assert.equal(current.length, 1)
    assert.equal(current[0].studentId, one.studentId)
    assert.equal(current[0].disabled, true)
    assert.equal(current[0].departed, false)
    editStudent(
      f.db,
      context,
      promoted.id,
      one.studentId,
      { ...current[0], name: '本期改名' },
      randomUUID(),
      'rename'
    )
    assert.equal(listEnrollments(f.db, context.ownerId, source.id)[0].name, '同名')
    deleteStudent(f.db, context, promoted.id, one.studentId, 2, randomUUID(), 'delete-current')
    assert.equal(listEnrollments(f.db, context.ownerId, source.id).length, 2)
    assert.equal(listEnrollments(f.db, context.ownerId, promoted.id).length, 0)
    assert.ok(
      f.db.prepare('SELECT deletedAt FROM enrollments WHERE workspaceId=?').get(promoted.id)
        .deletedAt
    )
    assert.equal(f.db.prepare('SELECT count(*) AS count FROM students').get().count, 2)
  } finally {
    f.db.close()
  }
})

test('幂等重复返回原结果，同键不同操作拒绝，旧版本修改不覆盖数据', () => {
  const f = fixture()
  try {
    const context = f.actor(),
      key = randomUUID(),
      input = { className: '303', termName: '2026上' }
    const first = createWorkspace(f.db, context, input, key, 'first')
    const duplicate = createWorkspace(f.db, context, input, key, 'repeat')
    assert.equal(first.id, duplicate.id)
    assert.equal(listWorkspaces(f.db, context).length, 1)
    assert.throws(
      () => createWorkspace(f.db, context, { ...input, className: '404' }, key, 'spoof'),
      /请求键/
    )
    editWorkspace(
      f.db,
      context,
      first.id,
      { ...input, className: '304', version: 1 },
      randomUUID(),
      'change'
    )
    assert.throws(
      () =>
        editWorkspace(
          f.db,
          context,
          first.id,
          { ...input, className: '305', version: 1 },
          randomUUID(),
          'stale'
        ),
      /变化/
    )
    assert.equal(listWorkspaces(f.db, context)[0].className, '304')
    assert.equal(f.db.prepare('SELECT count(*) AS count FROM audit_logs').get().count, 2)
  } finally {
    f.db.close()
  }
})

test('转班失败回滚目标新增和源状态，成功仅新增目标名单且重复请求不重写', () => {
  const f = fixture()
  try {
    const context = f.actor(),
      source = f.workspace(context, '303'),
      target = f.workspace(context, '304')
    const student = addStudent(f.db, context, source.id, { name: '转班学生' }, randomUUID(), 'add')
    f.db.exec(
      "CREATE TRIGGER fail_transfer BEFORE UPDATE OF departed ON enrollments BEGIN SELECT RAISE(ABORT,'injected failure'); END"
    )
    assert.throws(
      () =>
        transferStudent(
          f.db,
          context,
          source.id,
          { studentId: student.studentId, targetId: target.id, version: 1 },
          randomUUID(),
          'fail'
        ),
      /injected/
    )
    assert.equal(listEnrollments(f.db, context.ownerId, target.id).length, 0)
    assert.equal(listEnrollments(f.db, context.ownerId, source.id)[0].departed, false)
    f.db.exec('DROP TRIGGER fail_transfer')
    const key = randomUUID(),
      input = { studentId: student.studentId, targetId: target.id, version: 1 }
    transferStudent(f.db, context, source.id, input, key, 'move')
    transferStudent(f.db, context, source.id, input, key, 'repeat')
    assert.equal(listEnrollments(f.db, context.ownerId, target.id).length, 1)
    assert.equal(listEnrollments(f.db, context.ownerId, source.id)[0].departed, true)
  } finally {
    f.db.close()
  }
})

test('schema v1 升级保留账号，不清库，重复迁移安全', () => {
  const db = new SQLite(':memory:')
  try {
    db.exec(readFileSync(new URL('../migrations/001-auth.sql', import.meta.url), 'utf8'))
    db.exec('PRAGMA user_version=1')
    db.prepare(
      "INSERT INTO users(id,phone,nickname,passwordHash,role,status,createdAt) VALUES('old','13800000000','旧账号','hash','ADMIN','ACTIVE',0)"
    ).run()
    migrate(db)
    migrate(db)
    assert.equal(db.prepare("SELECT nickname FROM users WHERE id='old'").get().nickname, '旧账号')
    assert.equal(db.pragma('user_version', { simple: true }), SCHEMA_VERSION)
  } finally {
    db.close()
  }
})
