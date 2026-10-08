import { test } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID, randomBytes } from 'node:crypto'
import { fixture } from './helpers/scores.mjs'
import { buildApp } from '../dist/app.js'
import {
  configFor,
  readAISettings,
  saveAIConfig,
  saveAIMode
} from '../dist/services/ai/settings.js'
import {
  quotaFor,
  listAIQuotas,
  adjustAIQuota,
  reserveAITokens,
  settleAITokens
} from '../dist/services/ai/quota.js'
import { decryptAIKey } from '../dist/services/ai/secrets.js'
const config = {
  provider: 'OPENAI',
  baseUrl: 'https://models.example.test/v1',
  model: 'test-model',
  enabled: true,
  version: 0,
  apiKey: 'private-test-key'
}
function withMasterKey(action) {
  const old = process.env.AI_ENCRYPTION_KEY
  process.env.AI_ENCRYPTION_KEY = randomBytes(32).toString('base64')
  try {
    return action()
  } finally {
    if (old === undefined) delete process.env.AI_ENCRYPTION_KEY
    else process.env.AI_ENCRYPTION_KEY = old
  }
}
test('默认平台模式，统一/个人配置加密、版本保护及幂等；写入回执不含密钥', () =>
  withMasterKey(() => {
    const f = fixture()
    try {
      const admin = f.actor('ADMIN')
      assert.equal(readAISettings(f.db, f.context).mode, 'PLATFORM')
      assert.equal(readAISettings(f.db, f.context).quota.available, 0)
      const key = randomUUID()
      const saved = saveAIConfig(f.db, admin, config, true, key, 'save')
      assert.deepEqual(saveAIConfig(f.db, admin, config, true, key, 'retry'), saved)
      assert.ok(!JSON.stringify(saved).includes(config.apiKey))
      const secret = f.db.prepare("SELECT secret FROM ai_configs WHERE id='platform'").get().secret
      assert.ok(!secret.includes(config.apiKey))
      assert.equal(decryptAIKey(secret), config.apiKey)
      assert.throws(
        () => saveAIConfig(f.db, admin, config, true, randomUUID(), 'stale'),
        (error) => error.code === 'VERSION_CONFLICT'
      )
      assert.throws(
        () => saveAIConfig(f.db, f.context, config, true, randomUUID(), 'unauthorized'),
        (error) => error.statusCode === 403
      )
      assert.throws(
        () =>
          saveAIConfig(
            f.db,
            f.context,
            { ...config, baseUrl: 'https://other.example.test' },
            false,
            randomUUID(),
            'blocked'
          ),
        (error) => error.code === 'AI_ENDPOINT_NOT_ALLOWED'
      )
      saveAIConfig(
        f.db,
        f.context,
        { ...config, apiKey: 'personal-private-key' },
        false,
        randomUUID(),
        'personal'
      )
      assert.equal(
        saveAIMode(f.db, f.context, { mode: 'PERSONAL', version: 0 }, randomUUID(), 'switch').mode,
        'PERSONAL'
      )
      assert.equal(configFor(f.db, 'platform').version, 1)
      const receipts = f.db.prepare('SELECT resultJson FROM mutation_receipts').all()
      assert.ok(!JSON.stringify(receipts).includes(config.apiKey))
    } finally {
      f.db.close()
    }
  }))
test('额度累计调整与流水：越权、重试、冲突和负余额均受控', () => {
  const f = fixture()
  try {
    const admin = f.actor('ADMIN'),
      id = f.context.actor.id,
      key = randomUUID()
    withMasterKey(() => saveAIConfig(f.db, admin, config, true, randomUUID(), 'configure'))
    const input = { delta: 1000, version: 0, reason: '初始分配' }
    const first = adjustAIQuota(f.db, admin, id, input, key, 'adjust')
    assert.deepEqual(adjustAIQuota(f.db, admin, id, input, key, 'retry'), first)
    assert.equal(first.available, 1000)
    assert.throws(
      () =>
        adjustAIQuota(
          f.db,
          f.context,
          id,
          { ...input, version: first.version },
          randomUUID(),
          'deny'
        ),
      (error) => error.statusCode === 403
    )
    assert.throws(
      () => adjustAIQuota(f.db, admin, id, input, randomUUID(), 'stale'),
      (error) => error.code === 'VERSION_CONFLICT'
    )
    assert.throws(
      () =>
        adjustAIQuota(
          f.db,
          admin,
          id,
          { delta: -1001, version: first.version, reason: '扣减' },
          randomUUID(),
          'negative'
        ),
      (error) => error.code === 'INVALID_QUOTA'
    )
    assert.equal(
      f.db.prepare("SELECT count(*) AS count FROM ai_quota_ledger WHERE kind='ADJUST'").get().count,
      1
    )
    assert.equal(quotaFor(f.db, id).available, 1000)
  } finally {
    f.db.close()
  }
})
test('调用预算预占防超额、按实际用量结算、已确认无消耗退回和重复结算', () => {
  const f = fixture()
  try {
    const admin = f.actor('ADMIN'),
      id = f.context.actor.id,
      call = randomUUID()
    withMasterKey(() => saveAIConfig(f.db, admin, config, true, randomUUID(), 'configure'))
    adjustAIQuota(
      f.db,
      admin,
      id,
      { delta: 1000, version: 0, reason: '调用预算' },
      randomUUID(),
      'adjust'
    )
    reserveAITokens(f.db, f.context, call, 800)
    assert.equal(quotaFor(f.db, id).available, 200)
    assert.throws(
      () => reserveAITokens(f.db, f.context, randomUUID(), 300),
      (error) => error.code === 'AI_QUOTA_EXHAUSTED'
    )
    assert.throws(
      () => reserveAITokens(f.db, f.context, call, 800),
      (error) => error.code === 'AI_CALL_EXISTS'
    )
    settleAITokens(f.db, call, 500)
    settleAITokens(f.db, call, 500)
    assert.deepEqual(quotaFor(f.db, id), { available: 500, reserved: 0, used: 500, version: 4 })
    assert.throws(
      () => settleAITokens(f.db, call, 400),
      (error) => error.code === 'AI_SETTLEMENT_CONFLICT'
    )
    const failure = randomUUID()
    reserveAITokens(f.db, f.context, failure, 400)
    assert.throws(
      () => settleAITokens(f.db, failure, 401),
      (error) => error.code === 'AI_USAGE_UNCERTAIN'
    )
    assert.equal(quotaFor(f.db, id).reserved, 400)
    settleAITokens(f.db, failure, 0, true)
    assert.equal(quotaFor(f.db, id).available, 500)
    assert.equal(quotaFor(f.db, id).reserved, 0)
  } finally {
    f.db.close()
  }
})
test('HTTP 拒绝伪造用量、身份代管和非管理员分配；新账号无需填写 Key', async () => {
  const f = fixture(),
    app = await buildApp(f.db, 'http://localhost:5173')
  try {
    const headers = { authorization: `Bearer ${f.context.token}` }
    const result = await app.inject({ method: 'GET', url: '/api/v1/me/ai', headers })
    assert.equal(result.statusCode, 200)
    assert.equal(result.json().mode, 'PLATFORM')
    assert.equal(
      (
        await app.inject({
          method: 'GET',
          url: '/api/v1/me/ai',
          headers: { ...headers, 'x-managed-account-id': f.context.actor.id }
        })
      ).statusCode,
      400
    )
    assert.equal(
      (
        await app.inject({
          method: 'POST',
          url: `/api/v1/admin/users/${f.context.actor.id}/ai-quota`,
          headers: { ...headers, 'idempotency-key': randomUUID() },
          payload: { delta: 100, version: 0, reason: '分配' }
        })
      ).statusCode,
      403
    )
    const admin = f.actor('ADMIN')
    withMasterKey(() => saveAIConfig(f.db, admin, config, true, randomUUID(), 'configure'))
    const adminHeaders = { authorization: `Bearer ${admin.token}`, 'idempotency-key': randomUUID() }
    assert.equal(
      (
        await app.inject({
          method: 'POST',
          url: `/api/v1/admin/users/${f.context.actor.id}/ai-quota`,
          headers: adminHeaders,
          payload: { delta: 100, version: 0, reason: '分配', used: -1000 }
        })
      ).statusCode,
      400
    )
    assert.equal(
      (
        await app.inject({
          method: 'POST',
          url: `/api/v1/admin/users/${f.context.actor.id}/ai-quota`,
          headers: adminHeaders,
          payload: { delta: 100, version: 0, reason: '分配' }
        })
      ).statusCode,
      200
    )
  } finally {
    await app.close()
    f.db.close()
  }
})

test('额度前置配置、老师状态与额度列表筛选均由服务器约束', () => {
  const f = fixture(),
    admin = f.actor('ADMIN'),
    other = f.actor()
  try {
    const input = { delta: 100, version: 0, reason: '首次分配' }
    const adjust = (id = f.context.ownerId, value = input) =>
      adjustAIQuota(f.db, admin, id, value, randomUUID(), 'quota-rule')
    assert.throws(
      () => adjust(),
      (error) => error.code === 'AI_NOT_CONFIGURED'
    )
    assert.equal(f.db.prepare('SELECT count(*) AS count FROM ai_quotas').get().count, 0)
    withMasterKey(() => saveAIConfig(f.db, admin, config, true, randomUUID(), 'configure'))
    assert.throws(
      () => adjust(admin.ownerId),
      (error) => error.code === 'FORBIDDEN'
    )
    adjust()
    adjust(other.ownerId)
    f.db.prepare("UPDATE users SET status='DISABLED' WHERE id=?").run(f.context.ownerId)
    assert.throws(
      () =>
        adjust(f.context.ownerId, { ...input, version: quotaFor(f.db, f.context.ownerId).version }),
      (error) => error.code === 'FORBIDDEN'
    )
    f.db.prepare("UPDATE ai_configs SET enabled=0 WHERE id='platform'").run()
    assert.throws(
      () => adjust(other.ownerId, { ...input, version: quotaFor(f.db, other.ownerId).version }),
      (error) => error.code === 'AI_NOT_CONFIGURED'
    )
    adjust(f.context.ownerId, {
      delta: -100,
      version: quotaFor(f.db, f.context.ownerId).version,
      reason: '收回未使用额度'
    })
    const list = listAIQuotas(f.db, { status: 'DISABLED' })
    assert.equal(list.total, 1)
    assert.equal(list.items[0].available, 0)
    assert.equal(listAIQuotas(f.db, { search: other.actor.phone }).total, 1)
    f.db.prepare("UPDATE users SET status='DELETED' WHERE id=?").run(other.ownerId)
    assert.equal(listAIQuotas(f.db, {}).total, 1)
  } finally {
    f.db.close()
  }
})

test('配置编辑接口回填有权编辑的 Key，清空后停用；平台摘要和幂等回执不含 Key', async () => {
  const f = fixture(),
    old = process.env.AI_ENCRYPTION_KEY
  process.env.AI_ENCRYPTION_KEY = randomBytes(32).toString('base64')
  const app = await buildApp(f.db, 'http://localhost:5173')
  try {
    const admin = f.actor('ADMIN')
    saveAIConfig(f.db, admin, config, true, randomUUID(), 'platform')
    saveAIConfig(
      f.db,
      f.context,
      { ...config, apiKey: 'personal-editor-key' },
      false,
      randomUUID(),
      'personal'
    )
    const get = (url, token) =>
      app.inject({
        method: 'GET',
        url: `/api/v1${url}`,
        headers: { authorization: `Bearer ${token}` }
      })
    const platform = await get('/admin/ai/config', admin.token)
    assert.equal(platform.statusCode, 200)
    assert.equal(platform.json().apiKey, config.apiKey)
    assert.equal(platform.headers['cache-control'], 'no-store')
    assert.equal((await get('/admin/ai/config', f.context.token)).statusCode, 403)
    const personal = await get('/me/ai', f.context.token)
    assert.equal(personal.json().personal.apiKey, 'personal-editor-key')
    assert.equal(personal.json().platform.apiKey, undefined)
    assert.ok(!personal.body.includes(config.apiKey))
    saveAIMode(f.db, f.context, { mode: 'PERSONAL', version: 0 }, randomUUID(), 'mode')
    const receipts = JSON.stringify(f.db.prepare('SELECT resultJson FROM mutation_receipts').all())
    assert.ok(!receipts.includes('personal-editor-key'))
    assert.ok(!receipts.includes(config.apiKey))
    saveAIConfig(
      f.db,
      f.context,
      { ...config, version: 1, apiKey: null, enabled: false },
      false,
      randomUUID(),
      'clear'
    )
    const cleared = (await get('/me/ai', f.context.token)).json().personal
    assert.equal(cleared.apiKey, '')
    assert.equal(cleared.configured, false)
    assert.equal(cleared.enabled, false)
  } finally {
    await app.close()
    f.db.close()
    if (old === undefined) delete process.env.AI_ENCRYPTION_KEY
    else process.env.AI_ENCRYPTION_KEY = old
  }
})

test('旧密钥无法解密仍可读取配置并重新保存，读取不改写密文', async () => {
  const f = fixture(),
    old = process.env.AI_ENCRYPTION_KEY
  const app = await buildApp(f.db, 'http://localhost:5173')
  try {
    const admin = f.actor('ADMIN')
    process.env.AI_ENCRYPTION_KEY = randomBytes(32).toString('base64')
    saveAIConfig(f.db, admin, config, true, randomUUID(), 'old-config')
    saveAIConfig(f.db, f.context, config, false, randomUUID(), 'old-personal')
    const secret = f.db.prepare("SELECT secret FROM ai_configs WHERE id='platform'").get().secret
    process.env.AI_ENCRYPTION_KEY = randomBytes(32).toString('base64')
    const headers = { authorization: `Bearer ${admin.token}` }
    const result = await app.inject({ method: 'GET', url: '/api/v1/admin/ai/config', headers })
    assert.equal(result.statusCode, 200)
    assert.equal(result.json().keyUnavailable, true)
    assert.equal(result.json().apiKey, '')
    assert.equal(result.json().baseUrl, config.baseUrl)
    assert.equal(result.json().version, 1)
    assert.equal(
      f.db.prepare("SELECT secret FROM ai_configs WHERE id='platform'").get().secret,
      secret
    )
    const personal = await app.inject({
      method: 'GET',
      url: '/api/v1/me/ai',
      headers: { authorization: `Bearer ${f.context.token}` }
    })
    assert.equal(personal.statusCode, 200)
    assert.equal(personal.json().personal.keyUnavailable, true)
    const saved = await app.inject({
      method: 'PUT',
      url: '/api/v1/admin/ai/config',
      headers: { ...headers, 'idempotency-key': randomUUID() },
      payload: { ...config, version: 1, apiKey: 'replacement-key' }
    })
    assert.equal(saved.statusCode, 200)
    const restored = await app.inject({ method: 'GET', url: '/api/v1/admin/ai/config', headers })
    assert.equal(restored.json().apiKey, 'replacement-key')
    assert.equal(restored.json().keyUnavailable, undefined)
  } finally {
    await app.close()
    f.db.close()
    if (old === undefined) delete process.env.AI_ENCRYPTION_KEY
    else process.env.AI_ENCRYPTION_KEY = old
  }
})
