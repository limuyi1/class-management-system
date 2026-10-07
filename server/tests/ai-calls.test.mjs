import { test } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID, randomBytes } from 'node:crypto'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fixture } from './helpers/scores.mjs'
import { saveAIConfig } from '../dist/services/ai/settings.js'
import { adjustAIQuota, quotaFor } from '../dist/services/ai/quota.js'
import { runAICall } from '../dist/services/ai/calls.js'
import { cancelAICall } from '../dist/services/ai/cancellation.js'
import { previewAIScores } from '../dist/services/ai/scoreReview.js'
import { commitImport } from '../dist/services/imports.js'
import { uploadAttachment } from '../dist/services/attachments.js'

/** 假模型验证付费流程，不连接供应商或消费实际额度。 */
test('识别结果不能提升单元格版本，取消请求不误释放未知账单', async () => {
  const f = fixture(),
    directory = mkdtempSync(join(tmpdir(), 'cms-ai-test-')),
    old = process.env.AI_ENCRYPTION_KEY
  process.env.AI_ENCRYPTION_KEY = randomBytes(32).toString('base64')
  try {
    const admin = f.actor('ADMIN')
    saveAIConfig(
      f.db,
      admin,
      {
        provider: 'OPENAI',
        baseUrl: 'https://model.example.test/v1',
        model: 'test',
        enabled: true,
        version: 0,
        apiKey: 'test-secret'
      },
      true,
      randomUUID(),
      'configure'
    )
    adjustAIQuota(
      f.db,
      admin,
      f.context.ownerId,
      { delta: 1000000, version: 0, reason: '测试额度' },
      randomUUID(),
      'quota'
    )
    const student = f.student('甲'),
      unit = f.assessment(),
      attachment = randomUUID()
    uploadAttachment(
      f.db,
      directory,
      f.context,
      attachment,
      {
        name: '成绩.png',
        version: 0,
        mimeType: 'image/png',
        buffer: Buffer.from(
          'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jK1sAAAAASUVORK5CYII=',
          'base64'
        )
      },
      randomUUID(),
      'upload'
    )
    const call = await runAICall(
      f.db,
      f.context,
      {
        scene: 'recognize',
        prompt: '读取',
        workspaceId: f.workspace.id,
        workspaceVersion: f.read().workspace.version,
        attachmentId: attachment,
        attachmentVersion: 1
      },
      randomUUID(),
      'recognize',
      directory,
      async () => ({ text: '[]', inputTokens: 10, outputTokens: 20 })
    )
    const items = [{ studentId: student.studentId, assessmentId: unit.id, value: 0 }]
    const preview = previewAIScores(f.db, f.context, call.id, items)
    assert.equal(preview.errors.length, 0)
    f.write([{ ...items[0], value: 50, expectedVersion: 0 }])
    assert.throws(
      () => commitImport(f.db, f.context, preview.id, 'scores', randomUUID(), 'stale'),
      (e) => e.code === 'VERSION_CONFLICT'
    )
    assert.equal(
      previewAIScores(f.db, f.context, call.id, [{ ...items[0], studentId: randomUUID() }]).errors
        .length,
      1
    )
    const key = randomUUID()
    const running = runAICall(
      f.db,
      f.context,
      { scene: 'test', prompt: '' },
      key,
      'cancel',
      directory,
      ({ signal }) =>
        new Promise((_resolve, reject) =>
          signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true })
        )
    )
    assert.throws(
      () => cancelAICall(f.db, f.actor(), key),
      (e) => e.statusCode === 404
    )
    assert.equal(cancelAICall(f.db, f.context, key).cancelled, true)
    await assert.rejects(running, (e) => e.code === 'AI_CALL_UNCERTAIN')
    assert.ok(quotaFor(f.db, f.context.ownerId).reserved > 0)
  } finally {
    f.db.close()
    rmSync(directory, { recursive: true, force: true })
    if (old === undefined) delete process.env.AI_ENCRYPTION_KEY
    else process.env.AI_ENCRYPTION_KEY = old
  }
})

/** 核对结算、调用状态及幂等回执必须同事务完成，重复提交不重复扣款。 */
test('管理员核对未知账单支持幂等并拒绝普通账号', async () => {
  const f = fixture(),
    old = process.env.AI_ENCRYPTION_KEY
  process.env.AI_ENCRYPTION_KEY = randomBytes(32).toString('base64')
  const { buildApp } = await import('../dist/app.js')
  const app = await buildApp(f.db, 'http://localhost:5173')
  try {
    const admin = f.actor('ADMIN')
    saveAIConfig(
      f.db,
      admin,
      {
        provider: 'OPENAI',
        baseUrl: 'https://model.example.test/v1',
        model: 'test',
        enabled: true,
        version: 0,
        apiKey: 'test'
      },
      true,
      randomUUID(),
      'config'
    )
    adjustAIQuota(
      f.db,
      admin,
      f.context.ownerId,
      { delta: 1000000, version: 0, reason: '测试' },
      randomUUID(),
      'quota'
    )
    await assert.rejects(
      runAICall(
        f.db,
        f.context,
        { scene: 'test', prompt: '' },
        randomUUID(),
        'fail',
        '/tmp',
        async () => {
          throw new Error('lost response')
        }
      ),
      (e) => e.code === 'AI_CALL_UNCERTAIN'
    )
    const call = f.db.prepare('SELECT id FROM ai_calls').get()
    const url = `/api/v1/admin/ai/calls/${call.id}/reconcile`,
      payload = { actual: 123, reason: '供应商账单确认' }
    const headers = { authorization: `Bearer ${admin.token}`, 'idempotency-key': randomUUID() }
    assert.equal(
      (
        await app.inject({
          method: 'POST',
          url,
          headers: { ...headers, authorization: `Bearer ${f.context.token}` },
          payload
        })
      ).statusCode,
      403
    )
    for (let i = 0; i < 2; i++)
      assert.equal((await app.inject({ method: 'POST', url, headers, payload })).statusCode, 200)
    assert.equal(quotaFor(f.db, f.context.ownerId).reserved, 0)
    assert.equal(quotaFor(f.db, f.context.ownerId).used, 123)
    assert.equal(
      f.db.prepare('SELECT status FROM ai_calls WHERE id=?').get(call.id).status,
      'FAILED'
    )
    assert.equal(
      (await app.inject({ method: 'POST', url, headers, payload: { ...payload, actual: 124 } }))
        .statusCode,
      409
    )
  } finally {
    await app.close()
    f.db.close()
    if (old === undefined) delete process.env.AI_ENCRYPTION_KEY
    else process.env.AI_ENCRYPTION_KEY = old
  }
})
