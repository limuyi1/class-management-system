import { test } from 'node:test'
import assert from 'node:assert/strict'
import { randomBytes, randomUUID } from 'node:crypto'
import { fixture } from './helpers/scores.mjs'
import { listAIModels } from '../dist/services/ai/models.js'
import { saveAIConfig, configFor } from '../dist/services/ai/settings.js'

const input = { provider: 'OPENAI', baseUrl: 'https://models.example.test/v1', apiKey: 'test-key' }
test('模型刷新使用草稿，不保存配置；去重并排除无效模型名称', async () => {
  const f = fixture()
  try {
    const admin = f.actor('ADMIN')
    const result = await listAIModels(f.db, admin, input, true, async (url, headers, body) => {
      assert.equal(url.href, `${input.baseUrl}/models`)
      assert.equal(headers.Authorization, 'Bearer test-key')
      assert.equal(body, undefined)
      return {
        data: [{ id: 'model-2' }, { id: 'model-1' }, { id: 'model-2' }, { id: 'invalid model' }]
      }
    })
    assert.deepEqual(result, ['model-1', 'model-2'])
    assert.equal(configFor(f.db, 'platform').version, 0)
    await assert.rejects(
      listAIModels(f.db, f.context, input, true),
      (error) => error.statusCode === 403
    )
    assert.deepEqual(
      await listAIModels(
        f.db,
        admin,
        { ...input, baseUrl: 'http://localhost:11434/v1' },
        true,
        async (url) => {
          assert.equal(url.href, 'http://localhost:11434/v1/models')
          return { data: [{ id: 'local-model' }] }
        }
      ),
      ['local-model']
    )
  } finally {
    f.db.close()
  }
})
test('已保存密钥仅在原服务复用；个人账号只能查询平台允许的服务', async () => {
  const f = fixture(),
    old = process.env.AI_ENCRYPTION_KEY
  process.env.AI_ENCRYPTION_KEY = randomBytes(32).toString('base64')
  try {
    const admin = f.actor('ADMIN')
    const config = { ...input, model: 'old-model', enabled: true, version: 0 }
    saveAIConfig(f.db, admin, config, true, randomUUID(), 'configure')
    const request = async (_url, headers) => {
      assert.equal(headers.Authorization, 'Bearer test-key')
      return { data: [{ id: 'model-1' }] }
    }
    const savedInput = { provider: input.provider, baseUrl: input.baseUrl }
    assert.deepEqual(await listAIModels(f.db, admin, savedInput, true, request), ['model-1'])
    await assert.rejects(
      listAIModels(
        f.db,
        admin,
        { ...savedInput, baseUrl: 'https://other.example.test' },
        true,
        request
      ),
      (error) => error.code === 'AI_KEY_REQUIRED'
    )
    await assert.rejects(
      listAIModels(
        f.db,
        f.context,
        { ...input, baseUrl: 'https://other.example.test' },
        false,
        request
      ),
      (error) => error.code === 'AI_ENDPOINT_NOT_ALLOWED'
    )
    saveAIConfig(f.db, f.context, config, false, randomUUID(), 'personal')
    assert.deepEqual(await listAIModels(f.db, f.context, savedInput, false, request), ['model-1'])
    assert.equal(configFor(f.db, 'platform').model, 'old-model')
    assert.equal(configFor(f.db, 'platform').version, 1)
  } finally {
    f.db.close()
    if (old === undefined) delete process.env.AI_ENCRYPTION_KEY
    else process.env.AI_ENCRYPTION_KEY = old
  }
})
test('Gemini 处理分页和前缀，只保留生成模型；无效响应明确失败', async () => {
  const f = fixture()
  try {
    const admin = f.actor('ADMIN')
    let page = 0
    const result = await listAIModels(
      f.db,
      admin,
      { ...input, provider: 'GEMINI' },
      true,
      async (url, headers, body) => {
        assert.equal(headers['x-goog-api-key'], 'test-key')
        assert.equal(body, undefined)
        assert.equal(url.searchParams.get('pageSize'), '1000')
        if (page++ === 0)
          return {
            models: [
              { name: 'models/gemini-a', supportedGenerationMethods: ['generateContent'] },
              { name: 'models/embedding', supportedGenerationMethods: ['embedContent'] }
            ],
            nextPageToken: 'next'
          }
        assert.equal(url.searchParams.get('pageToken'), 'next')
        return {
          models: [{ name: 'models/gemini-b', supportedGenerationMethods: ['generateContent'] }]
        }
      }
    )
    assert.deepEqual(result, ['gemini-a', 'gemini-b'])
    await assert.rejects(
      listAIModels(f.db, admin, input, true, async () => ({ error: 'private upstream error' })),
      (error) => error.code === 'AI_INVALID_RESPONSE' && !error.message.includes('private')
    )
  } finally {
    f.db.close()
  }
})

test('模型目录 HTTP 入口拒绝非管理员和旧代管头，缺少 Key 不发起外部请求', async () => {
  const { buildApp } = await import('../dist/app.js')
  const f = fixture(),
    app = await buildApp(f.db, 'http://localhost:5173')
  try {
    const admin = f.actor('ADMIN')
    const query = async (token, payload = input, extraHeaders = {}) =>
      app.inject({
        method: 'POST',
        url: '/api/v1/admin/ai/models',
        headers: { authorization: `Bearer ${token}`, ...extraHeaders },
        payload
      })
    assert.equal((await query(f.context.token)).statusCode, 403)
    assert.equal(
      (await query(admin.token, input, { 'x-managed-account-id': f.context.ownerId })).statusCode,
      400
    )
    assert.equal(
      (await query(admin.token, { provider: input.provider, baseUrl: input.baseUrl })).statusCode,
      400
    )
    assert.equal(
      (await query(admin.token, { ...input, ownerId: f.context.ownerId })).statusCode,
      400
    )
    const personal = await app.inject({
      method: 'POST',
      url: '/api/v1/me/ai/models',
      headers: { authorization: `Bearer ${f.context.token}` },
      payload: input
    })
    assert.equal(personal.statusCode, 400)
    assert.equal(f.db.prepare('SELECT COUNT(*) AS count FROM ai_calls').get().count, 0)
  } finally {
    await app.close()
    f.db.close()
  }
})
