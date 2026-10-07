import { test } from 'node:test'
import assert from 'node:assert/strict'
import { validatePassword, hashPassword, verifyPassword } from '../dist/auth/password.js'
import { buildApp } from '../dist/app.js'
import { migrate } from '../dist/db/migrate.js'
import { createSession } from '../dist/auth/tokens.js'
import SQLite from 'better-sqlite3'

test('允许短密码、纯字母、中文和旧弱口令，不要求字符组合', async () => {
  for (const value of [
    'a',
    'abc',
    'aaaa',
    'password',
    'qwerty',
    '123456a',
    '中文',
    'a'.repeat(128)
  ]) {
    assert.doesNotThrow(() => validatePassword(value))
  }
  const hash = await hashPassword('abc')
  assert.equal(await verifyPassword('abc', hash), true)
  assert.equal(await verifyPassword('abd', hash), false)
})
test('空白、纯数字（包括全角数字）和超长内容返回明确错误', () => {
  for (const value of ['', '   ', '\t\n', '123', ' 123 ', '１２３', '١٢٣', 'a'.repeat(129)]) {
    assert.throws(() => validatePassword(value), { code: 'INVALID_PASSWORD' })
  }
  assert.throws(() => validatePassword('123456'), /密码不能是纯数字/)
})
/** 仅在内存数据库验证首次设置及首登改密，不修改真实账号密码。 */
test('首次设置接受短密码，首登改密拒绝纯数字并支持短字母密码', async () => {
  const db = new SQLite(':memory:')
  migrate(db, new URL('../migrations/', import.meta.url).pathname)
  const origin = 'http://127.0.0.1:5173'
  const app = await buildApp(db, origin)
  try {
    const result = await app.inject({
      method: 'POST',
      url: '/api/v1/setup/admin',
      headers: { origin, 'x-csrf-protection': '1', 'idempotency-key': 'short-password-setup' },
      payload: { phone: '13800000000', initialPassword: 'abc' }
    })
    assert.equal(result.statusCode, 200, result.body)
    const user = db.prepare('SELECT * FROM users').get()
    const authorization = `Bearer ${createSession(db, user).accessToken}`
    const change = (newPassword) =>
      app.inject({
        method: 'POST',
        url: '/api/v1/me/password',
        headers: { authorization },
        payload: { currentPassword: 'abc', newPassword }
      })
    const numeric = await change('123456')
    assert.equal(numeric.statusCode, 400, numeric.body)
    assert.equal(numeric.json().message, '密码不能是纯数字')
    const changed = await change('abcd')
    assert.equal(changed.statusCode, 200, changed.body)
    assert.equal(
      await verifyPassword('abcd', db.prepare('SELECT passwordHash FROM users').get().passwordHash),
      true
    )
    assert.equal(
      (await app.inject({ url: '/api/v1/auth/me', headers: { authorization } })).statusCode,
      401
    )
  } finally {
    await app.close()
    db.close()
  }
})
