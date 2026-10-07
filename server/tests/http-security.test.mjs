/** 完整 Fastify 注入验证，不启动开发服务器，不使用真实业务数据库。 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import SQLite from 'better-sqlite3'

import { buildApp } from '../dist/app.js'
import { migrate } from '../dist/db/migrate.js'
import { createSession } from '../dist/auth/tokens.js'

async function fixture() {
  const db = new SQLite(':memory:')
  migrate(db, new URL('../migrations/', import.meta.url).pathname)
  const app = await buildApp(db, 'http://127.0.0.1:5173')
  const create = (role, mustChangePassword = 0) => {
    const id = randomUUID()
    db.prepare(
      `INSERT INTO users(id,phone,nickname,passwordHash,role,status,mustChangePassword,createdAt)
      VALUES(?,?,?,?,?,'ACTIVE',?,?)`
    ).run(
      id,
      `138${String(Math.floor(Math.random() * 1e8)).padStart(8, '0')}`,
      '测试账号',
      'hash',
      role,
      mustChangePassword,
      Date.now()
    )
    const user = db.prepare('SELECT * FROM users WHERE id=?').get(id)
    return { user, authorization: `Bearer ${createSession(db, user).accessToken}` }
  }
  return {
    app,
    db,
    create,
    close: async () => {
      await app.close()
      db.close()
    }
  }
}

test('普通账号不能访问管理员接口，也不能伪造自改 role/VIP', async () => {
  const f = await fixture()
  try {
    const ordinary = f.create('USER')
    const response = await f.app.inject({
      method: 'GET',
      url: '/api/v1/admin/users',
      headers: { authorization: ordinary.authorization }
    })
    assert.equal(response.statusCode, 403)
    const spoof = await f.app.inject({
      method: 'PATCH',
      url: '/api/v1/me/profile',
      headers: { authorization: ordinary.authorization },
      payload: { nickname: '恶意提权', role: 'ADMIN', superVip: true }
    })
    assert.equal(spoof.statusCode, 400)
    assert.equal(
      f.db.prepare('SELECT role FROM users WHERE id=?').get(ordinary.user.id).role,
      'USER'
    )
  } finally {
    await f.close()
  }
})

test('身份接口拒绝代管头，管理员删除/禁用保护不可通过 HTTP 绕过', async () => {
  const f = await fixture()
  try {
    const admin = f.create('ADMIN'),
      target = f.create('USER')
    const managed = await f.app.inject({
      method: 'GET',
      url: '/api/v1/auth/me',
      headers: { authorization: admin.authorization, 'x-managed-account-id': target.user.id }
    })
    assert.equal(managed.statusCode, 400)
    const deletion = await f.app.inject({
      method: 'DELETE',
      url: `/api/v1/admin/users/${admin.user.id}`,
      headers: { authorization: admin.authorization }
    })
    assert.equal(deletion.statusCode, 403)
    const disabled = await f.app.inject({
      method: 'PATCH',
      url: `/api/v1/admin/users/${admin.user.id}/status`,
      headers: { authorization: admin.authorization },
      payload: { status: 'DISABLED' }
    })
    assert.equal(disabled.statusCode, 403)
  } finally {
    await f.close()
  }
})

test('首登改密不能绕过，刷新校验来源，移除的备份接口不存在', async () => {
  const f = await fixture()
  try {
    const ordinary = f.create('USER', 1)
    const protectedRequest = await f.app.inject({
      method: 'PATCH',
      url: '/api/v1/me/profile',
      headers: { authorization: ordinary.authorization },
      payload: { nickname: '新昵称' }
    })
    assert.equal(protectedRequest.statusCode, 403)
    assert.equal(protectedRequest.json().code, 'PASSWORD_CHANGE_REQUIRED')
    const me = await f.app.inject({
      method: 'GET',
      url: '/api/v1/auth/me',
      headers: { authorization: ordinary.authorization }
    })
    assert.equal(me.statusCode, 200)
    assert.equal('passwordHash' in me.json(), false)
    const refresh = await f.app.inject({
      method: 'POST',
      url: '/api/v1/auth/refresh',
      headers: { origin: 'https://evil.example', 'x-csrf-protection': '1' }
    })
    assert.equal(refresh.statusCode, 403)
    const backup = await f.app.inject({
      method: 'GET',
      url: '/api/v1/exports/backup',
      headers: { authorization: ordinary.authorization }
    })
    assert.equal(backup.statusCode, 404)
  } finally {
    await f.close()
  }
})

test('业务 HTTP 校验 owner 与幂等键，代管只改目标且写入实际操作者审计', async () => {
  const f = await fixture()
  try {
    const ordinary = f.create('USER'),
      other = f.create('USER'),
      admin = f.create('ADMIN')
    const payload = { className: '303', termName: '2026上' }
    const headers = { authorization: ordinary.authorization, 'idempotency-key': randomUUID() }
    const missingKey = await f.app.inject({
      method: 'POST',
      url: '/api/v1/workspaces',
      headers: { authorization: ordinary.authorization },
      payload
    })
    assert.equal(missingKey.statusCode, 400)
    const created = await f.app.inject({
      method: 'POST',
      url: '/api/v1/workspaces',
      headers,
      payload
    })
    assert.equal(created.statusCode, 200)
    const id = created.json().id
    const replay = await f.app.inject({
      method: 'POST',
      url: '/api/v1/workspaces',
      headers,
      payload
    })
    assert.equal(replay.json().id, id)
    const crossResource = await f.app.inject({
      method: 'GET',
      url: `/api/v1/workspaces/${id}/state`,
      headers: { authorization: other.authorization }
    })
    assert.equal(crossResource.statusCode, 404)
    const spoof = await f.app.inject({
      method: 'GET',
      url: '/api/v1/workspaces',
      headers: { authorization: other.authorization, 'x-managed-account-id': ordinary.user.id }
    })
    assert.equal(spoof.statusCode, 403)
    f.db.prepare('UPDATE users SET superVip=1 WHERE id=?').run(admin.user.id)
    const managed = {
      authorization: admin.authorization,
      'x-managed-account-id': ordinary.user.id,
      'idempotency-key': randomUUID()
    }
    const added = await f.app.inject({
      method: 'POST',
      url: `/api/v1/workspaces/${id}/students`,
      headers: managed,
      payload: { name: '代管新增' }
    })
    assert.equal(added.statusCode, 200)
    const audit = f.db
      .prepare("SELECT actorId,ownerId FROM audit_logs WHERE action='STUDENT_ADD'")
      .get()
    assert.deepEqual(audit, { actorId: admin.user.id, ownerId: ordinary.user.id })
    const state = await f.app.inject({
      method: 'GET',
      url: `/api/v1/workspaces/${id}/state`,
      headers: managed
    })
    assert.equal(state.json().students.length, 1)
    f.db.prepare('UPDATE users SET superVip=0 WHERE id=?').run(admin.user.id)
    const closed = await f.app.inject({
      method: 'GET',
      url: `/api/v1/workspaces/${id}/state`,
      headers: managed
    })
    assert.equal(closed.statusCode, 403)
  } finally {
    await f.close()
  }
})

/** 代理地址白名单不能变成客户端伪造登录限流 IP 的入口。 */
test('仅受信代理可以提供真实访问 IP', async () => {
  const old = process.env.TRUST_PROXY
  process.env.TRUST_PROXY = '172.30.70.2'
  const database = new SQLite(':memory:')
  migrate(database)
  const app = await buildApp(database, 'http://localhost:5173')
  app.get('/proxy-test', async (req) => ({ ip: req.ip }))
  try {
    const direct = await app.inject({
      url: '/proxy-test',
      remoteAddress: '192.0.2.20',
      headers: { 'x-forwarded-for': '8.8.8.8' }
    })
    assert.equal(direct.json().ip, '192.0.2.20')
    const proxy = await app.inject({
      url: '/proxy-test',
      remoteAddress: '172.30.70.2',
      headers: { 'x-forwarded-for': '8.8.8.8' }
    })
    assert.equal(proxy.json().ip, '8.8.8.8')
  } finally {
    await app.close()
    database.close()
    if (old === undefined) delete process.env.TRUST_PROXY
    else process.env.TRUST_PROXY = old
  }
})
