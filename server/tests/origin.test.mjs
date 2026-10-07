import { test } from 'node:test'
import assert from 'node:assert/strict'
import SQLite from 'better-sqlite3'
import { isAllowedOrigin } from '../dist/auth/origin.js'
import { buildApp } from '../dist/app.js'
import { migrate } from '../dist/db/migrate.js'
import { createChallenge, verifyChallenge } from '../dist/auth/captcha.js'
const configured = 'http://127.0.0.1:5173'
test('本机开发地址互换，协议和端口仍严格匹配', () => {
  for (const origin of [configured, 'http://localhost:5173', 'http://[::1]:5173']) {
    assert.equal(isAllowedOrigin(origin, configured, false), true)
  }
  assert.equal(isAllowedOrigin(configured, 'http://localhost:5173', false), true)
  for (const origin of [
    undefined,
    'null',
    'http://localhost:5174',
    'https://localhost:5173',
    'http://localhost.evil.example:5173',
    'http://192.168.1.1:5173',
    'http://localhost:5173/',
    'http://user@localhost:5173',
    'invalid'
  ]) {
    assert.equal(isAllowedOrigin(origin, configured, false), false, origin)
  }
  assert.equal(isAllowedOrigin('http://localhost:5173', 'https://example.com', false), false)
  assert.equal(isAllowedOrigin('http://localhost:5173', configured, true), false)
  assert.equal(isAllowedOrigin(configured, configured, true), true)
})
test('登录刷新和初始化共用本机来源策略，不能绕过 CSRF', async () => {
  const db = new SQLite(':memory:')
  migrate(db, new URL('../migrations/', import.meta.url).pathname)
  const app = await buildApp(db, configured)
  try {
    const headers = { origin: 'http://localhost:5173', 'x-csrf-protection': '1' }
    const refresh = await app.inject({ method: 'POST', url: '/api/v1/auth/refresh', headers })
    assert.equal(refresh.statusCode, 401)
    assert.equal(refresh.json().code, 'UNAUTHENTICATED')
    const csrf = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/refresh',
      headers: { origin: headers.origin }
    })
    assert.equal(csrf.statusCode, 403)
    assert.equal(csrf.json().code, 'CSRF_REQUIRED')
    const setup = await app.inject({
      method: 'POST',
      url: '/api/v1/setup/admin',
      headers: { ...headers, 'idempotency-key': 'localhost-setup-key' },
      payload: { phone: '13800000000', initialPassword: 'Local-setup-password!Aa1' }
    })
    assert.equal(setup.statusCode, 200, setup.body)
    // 挑战答案仅从测试内存数据库读取，不接触真实用户验证码。
    const challenge = createChallenge(db, '13800000000')
    const answer = db
      .prepare('SELECT answer FROM captcha_challenges WHERE id=?')
      .get(challenge.challengeId).answer
    const ticket = verifyChallenge(db, challenge.challengeId, answer)
    const loginStarted = Date.now()
    const login = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      headers,
      payload: { phone: '13800000000', password: 'Local-setup-password!Aa1', ticket }
    })
    assert.equal(login.statusCode, 200, login.body)
    const expiresIn = login.json().expiresIn
    assert.ok(
      expiresIn <= 3600 && expiresIn >= 3600 - Math.ceil((Date.now() - loginStarted) / 1000) - 1
    )
    assert.ok(login.headers['set-cookie'])
    const foreign = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/refresh',
      headers: { ...headers, origin: 'http://localhost.evil.example:5173' }
    })
    assert.equal(foreign.json().code, 'INVALID_ORIGIN')
  } finally {
    await app.close()
    db.close()
  }
})
