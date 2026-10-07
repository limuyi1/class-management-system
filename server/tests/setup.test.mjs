import { test } from 'node:test'
import assert from 'node:assert/strict'
import SQLite from 'better-sqlite3'
import { buildApp } from '../dist/app.js'
import { migrate } from '../dist/db/migrate.js'
import { createInitialAdmin, needsInitialAdmin } from '../dist/services/setup.js'
import { verifyPassword } from '../dist/auth/password.js'
import { createSession } from '../dist/auth/tokens.js'

/** 测试只使用内存数据库，验证首任管理员、重试及权限边界。 */
async function fixture() {
  const db = new SQLite(':memory:')
  migrate(db, new URL('../migrations/', import.meta.url).pathname)
  const app = await buildApp(db, 'http://127.0.0.1:5173')
  const body = { phone: '13800000000', initialPassword: 'Random-setup-password!Aa1' }
  const submit = (extra = {}) =>
    app.inject({
      method: 'POST',
      url: '/api/v1/setup/admin',
      payload: body,
      headers: {
        origin: 'http://127.0.0.1:5173',
        'x-csrf-protection': '1',
        'idempotency-key': 'setup-test-key'
      },
      ...extra
    })
  return {
    db,
    app,
    body,
    submit,
    close: async () => {
      await app.close()
      db.close()
    }
  }
}
test('首次设置、同请求重试、密码哈希与首登改密限制', async () => {
  const f = await fixture()
  try {
    const status = await f.app.inject('/api/v1/setup/status')
    assert.deepEqual(status.json(), { required: true, available: true })
    assert.equal(status.headers['cache-control'], 'no-store')
    const response = await f.submit()
    assert.equal(response.statusCode, 200, response.body)
    const user = f.db.prepare('SELECT * FROM users').get()
    assert.equal(user.nickname, '管理员')
    assert.equal(user.mustChangePassword, 1)
    assert.equal(await verifyPassword(f.body.initialPassword, user.passwordHash), true)
    assert.equal(response.body.includes(f.body.initialPassword), false)
    assert.equal(
      JSON.stringify(f.db.prepare('SELECT * FROM mutation_receipts').all()).includes(
        f.body.initialPassword
      ),
      false
    )
    assert.deepEqual((await f.submit()).json(), response.json())
    assert.equal(f.db.prepare('SELECT count(*) AS n FROM users').get().n, 1)
    assert.equal(
      (
        await f.submit({
          headers: {
            origin: 'http://127.0.0.1:5173',
            'x-csrf-protection': '1',
            'idempotency-key': 'another-setup-key'
          }
        })
      ).statusCode,
      409
    )
    assert.equal((await f.app.inject('/api/v1/setup/status')).json().required, false)
    const authorization = `Bearer ${createSession(f.db, user).accessToken}`
    assert.equal(
      (await f.app.inject({ url: '/api/v1/workspaces', headers: { authorization } })).statusCode,
      403
    )
    assert.equal(
      (await f.app.inject({ url: '/api/v1/auth/me', headers: { authorization } })).statusCode,
      200
    )
  } finally {
    await f.close()
  }
})
test('并发首任创建只有一个成功，已有管理员不受空教学数据影响', async () => {
  const f = await fixture()
  try {
    const results = await Promise.allSettled([
      createInitialAdmin(f.db, f.body, 'concurrent-key-1', 'test'),
      createInitialAdmin(f.db, { ...f.body, phone: '13900000000' }, 'concurrent-key-2', 'test')
    ])
    assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1)
    assert.equal(needsInitialAdmin(f.db), false)
    assert.equal(f.db.prepare('SELECT count(*) AS n FROM users').get().n, 1)
  } finally {
    await f.close()
  }
})
test('远程、伪造转发头、生产环境、错误来源和代管头不能初始化', async () => {
  const f = await fixture()
  const old = process.env.NODE_ENV
  try {
    assert.equal((await f.submit({ remoteAddress: '198.51.100.10' })).statusCode, 403)
    assert.equal(
      (
        await f.submit({
          remoteAddress: '198.51.100.10',
          headers: { 'x-forwarded-for': '127.0.0.1' }
        })
      ).statusCode,
      403
    )
    assert.equal((await f.submit({ headers: { origin: 'http://evil.example' } })).statusCode, 403)
    assert.equal(
      (
        await f.submit({
          headers: {
            origin: 'http://127.0.0.1:5173',
            'x-csrf-protection': '1',
            'x-managed-account-id': 'other'
          }
        })
      ).statusCode,
      400
    )
    process.env.NODE_ENV = 'production'
    assert.equal((await f.submit()).statusCode, 403)
    assert.equal((await f.app.inject('/api/v1/setup/status')).json().available, false)
    assert.equal(needsInitialAdmin(f.db), true)
  } finally {
    if (old === undefined) delete process.env.NODE_ENV
    else process.env.NODE_ENV = old
    await f.close()
  }
})
