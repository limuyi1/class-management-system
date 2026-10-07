import { test } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID, randomBytes } from 'node:crypto'
import { fixture } from './helpers/scores.mjs'
import { saveResource, listResources, deleteResource } from '../dist/services/resources.js'
import { storeImportRows, previewImport, commitImport } from '../dist/services/imports.js'
import { runAICall, readAICall } from '../dist/services/ai/calls.js'
import { saveAIConfig } from '../dist/services/ai/settings.js'
import { adjustAIQuota, quotaFor, reconcileAITokens } from '../dist/services/ai/quota.js'
import { isPublicAddress } from '../dist/services/ai/transport.js'

/** 覆盖文档的归属、版本和软删除，避免跨账号文档引用和旧版本覆盖。 */
test('业务文档隔离、幂等和软删除', () => {
  const f = fixture()
  try {
    const input = {
      id: randomUUID(),
      kind: 'tags',
      workspaceId: f.workspace.id,
      name: '标签',
      content: { categories: ['表现'], tags: { 表现: ['认真'] }, assignments: {} },
      version: 0
    }
    const key = randomUUID()
    const saved = saveResource(f.db, f.context, input, key, 'save')
    assert.equal(saved.version, 1)
    assert.deepEqual(saveResource(f.db, f.context, input, key, 'retry'), saved)
    assert.throws(
      () => saveResource(f.db, f.context, input, randomUUID(), 'stale'),
      (e) => e.code === 'VERSION_CONFLICT'
    )
    assert.throws(
      () => saveResource(f.db, f.actor(), input, randomUUID(), 'foreign'),
      (e) => e.statusCode === 404
    )
    deleteResource(f.db, f.context, 'tags', input.id, 1, randomUUID(), 'delete')
    assert.equal(listResources(f.db, f.context, 'tags', f.workspace.id, 'read').length, 0)
    assert.ok(
      f.db.prepare('SELECT deletedAt FROM business_resources WHERE id=?').get(input.id).deletedAt
    )
  } finally {
    f.db.close()
  }
})

test('Excel 预览保留零与空值，冲突整批回滚，身份隔离及重复映射阻断', () => {
  const f = fixture()
  try {
    const a = f.student('甲'),
      b = f.student('乙'),
      unit = f.assessment()
    const id = storeImportRows(f.db, f.context, f.workspace.id, [
      ['姓名', '成绩'],
      ['甲', 0],
      ['乙', null]
    ])
    const mapping = {
      nameColumn: 0,
      idColumn: null,
      headerRow: 0,
      fields: [{ column: 1, assessmentId: unit.id }],
      commentColumn: null
    }
    const preview = previewImport(f.db, f.context, id, mapping)
    assert.deepEqual(
      preview.changes.map((row) => row.value),
      [0, null]
    )
    assert.throws(
      () => commitImport(f.db, f.actor(), id, 'scores', randomUUID(), 'foreign'),
      (e) => e.code === 'IMPORT_EXPIRED'
    )
    f.write([{ studentId: b.studentId, assessmentId: unit.id, value: 8, expectedVersion: 0 }])
    assert.throws(
      () => commitImport(f.db, f.context, id, 'scores', randomUUID(), 'stale'),
      (e) => e.statusCode === 409
    )
    assert.equal(
      f.read().scores.some((row) => row.studentId === a.studentId),
      false
    )
    assert.ok(
      previewImport(f.db, f.context, id, {
        ...mapping,
        fields: [...mapping.fields, ...mapping.fields]
      }).errors.length
    )
  } finally {
    f.db.close()
  }
})

test('公网模型连接策略拒绝私网、映射及保留地址', () => {
  for (const ip of [
    '127.0.0.1',
    '10.2.3.4',
    '172.16.1.1',
    '169.254.169.254',
    '100.64.0.1',
    '192.168.1.1',
    '198.18.0.1',
    '203.0.113.1',
    '::1',
    '::ffff:8.8.8.8',
    '2001:db8::1'
  ])
    assert.equal(isPublicAddress(ip), false, ip)
  assert.equal(isPublicAddress('8.8.8.8'), true)
  assert.equal(isPublicAddress('2606:4700:4700::1111'), true)
})

test('模型调用仅一次、累计结算、异常保留预占，管理员超预算核对记录原因', async () => {
  const f = fixture(),
    previous = process.env.AI_ENCRYPTION_KEY
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
        apiKey: 'secret-test'
      },
      true,
      randomUUID(),
      'config'
    )
    adjustAIQuota(
      f.db,
      admin,
      f.context.actor.id,
      { delta: 100000, version: 0, reason: '测试分配' },
      randomUUID(),
      'quota'
    )
    let calls = 0
    const invoke = async () => {
      calls++
      return { text: '连接正常', inputTokens: 12, outputTokens: 8 }
    }
    const key = randomUUID(),
      input = { scene: 'test', prompt: '' }
    const first = await runAICall(f.db, f.context, input, key, 'call', '/unused', invoke)
    assert.equal(first.status, 'DONE')
    assert.deepEqual(
      await runAICall(f.db, f.context, input, key, 'retry', '/unused', invoke),
      first
    )
    assert.equal(calls, 1)
    assert.equal(quotaFor(f.db, f.context.actor.id).used, 20)
    let id
    await assert.rejects(
      runAICall(f.db, f.context, input, randomUUID(), 'uncertain', '/unused', async () => {
        throw new Error('timeout')
      }),
      (e) => {
        id = e.details.id
        return e.code === 'AI_CALL_UNCERTAIN'
      }
    )
    assert.equal(readAICall(f.db, f.context, id).status, 'UNCERTAIN')
    assert.ok(quotaFor(f.db, f.context.actor.id).reserved > 0)
    reconcileAITokens(f.db, admin, id, 5000, '供应商账单确认')
    assert.equal(quotaFor(f.db, f.context.actor.id).reserved, 0)
    assert.equal(quotaFor(f.db, f.context.actor.id).used, 5020)
    assert.ok(
      f.db
        .prepare(
          "SELECT reason FROM ai_quota_ledger WHERE kind='SETTLE' AND reason LIKE '%供应商账单确认%'"
        )
        .get()
        .reason.includes('供应商账单确认')
    )
  } finally {
    f.db.close()
    if (previous === undefined) delete process.env.AI_ENCRYPTION_KEY
    else process.env.AI_ENCRYPTION_KEY = previous
  }
})

/** 批量名单提交保持独立身份，旧预览不覆盖已变化的班级。 */
test('名单导入使用整批事务，不按姓名合并，预览后变更拒绝提交', () => {
  const f = fixture()
  try {
    const id = storeImportRows(f.db, f.context, f.workspace.id, [['姓名'], ['同名'], ['同名']])
    const mapping = {
      kind: 'roster',
      nameColumn: 0,
      idColumn: null,
      headerRow: 0,
      fields: [],
      commentColumn: null
    }
    assert.equal(previewImport(f.db, f.context, id, mapping).errors.length, 0)
    const key = randomUUID()
    assert.equal(commitImport(f.db, f.context, id, 'roster', key, 'import').added, 2)
    assert.equal(commitImport(f.db, f.context, id, 'roster', key, 'retry').added, 2)
    assert.equal(new Set(f.read().students.map((row) => row.studentId)).size, 2)
    previewImport(f.db, f.context, id, mapping)
    f.student('新增')
    assert.throws(
      () => commitImport(f.db, f.context, id, 'roster', randomUUID(), 'stale'),
      (e) => e.code === 'VERSION_CONFLICT'
    )
  } finally {
    f.db.close()
  }
})
