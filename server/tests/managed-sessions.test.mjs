import { test } from 'node:test'
import assert from 'node:assert/strict'
import { randomBytes, randomUUID } from 'node:crypto'
import { fixture } from './helpers/scores.mjs'
import { buildApp } from '../dist/app.js'
import { beginManaged } from '../dist/auth/managed.js'
import { tokenHash } from '../dist/auth/tokens.js'
import { hashPassword } from '../dist/auth/password.js'
import { runAICall } from '../dist/services/ai/calls.js'
import { saveAIConfig, saveAIMode } from '../dist/services/ai/settings.js'
import { adjustAIQuota, quotaFor } from '../dist/services/ai/quota.js'
import { validateContext } from '../dist/services/mutations.js'

async function managedFixture() {
  const f = fixture()
  const admin = f.actor('ADMIN')
  f.db.prepare('UPDATE users SET superVip=1 WHERE id=?').run(admin.actor.id)
  admin.actor.superVip = 1
  const session = beginManaged(f.db, admin.actor, f.context.actor.id, 'switch')
  const context = {
    ...admin,
    ownerId: f.context.ownerId,
    managedSessionId: tokenHash(session.token)
  }
  const app = await buildApp(f.db, 'http://127.0.0.1:5173')
  const headers = { authorization: `Bearer ${admin.token}`, 'x-managed-session': session.token }
  const request = (url, method = 'GET', payload, extra = {}) =>
    app.inject({ url: `/api/v1${url}`, method, payload, headers: { ...headers, ...extra } })
  return {
    ...f,
    teacher: f.context,
    admin,
    session,
    context,
    app,
    headers,
    request,
    close: async () => {
      await app.close()
      f.db.close()
    }
  }
}

test('完整代管与老师直登读取同一资料、教学数据、皮肤和 AI 额度；管理员接口拒绝', async () => {
  const f = await managedFixture()
  try {
    f.student('学生甲')
    f.assessment()
    for (const path of [
      '/me/context',
      '/workspaces',
      `/workspaces/${f.workspace.id}/state`,
      `/workspaces/${f.workspace.id}/scores`,
      '/resources?kind=settings',
      '/me/appearance',
      '/me/ai'
    ]) {
      const direct = await f.app.inject({
        url: `/api/v1${path}`,
        headers: { authorization: `Bearer ${f.teacher.token}` }
      })
      const managed = await f.request(path)
      assert.equal(managed.statusCode, 200, path)
      assert.deepEqual(managed.json(), direct.json(), path)
      assert.ok(!managed.body.includes('passwordHash'))
    }
    for (const path of [
      '/admin/users',
      '/admin/managed-accounts',
      '/admin/ai/config',
      '/admin/ai/calls',
      `/admin/users/${f.context.ownerId}/ai-quota`
    ])
      assert.equal((await f.request(path)).statusCode, 403, path)
    assert.equal(
      (
        await f.request(
          `/admin/users/${f.context.ownerId}/ai-quota`,
          'POST',
          { delta: 100, version: 0, reason: '越权' },
          { 'idempotency-key': randomUUID() }
        )
      ).statusCode,
      403
    )
    assert.equal(
      (
        await f.request('/workspaces', 'GET', undefined, {
          'x-managed-account-id': f.admin.actor.id
        })
      ).statusCode,
      403
    )
    const rename = await f.request('/me/profile', 'PATCH', { nickname: '目标老师' })
    assert.equal(rename.statusCode, 200)
    assert.equal(
      f.db.prepare('SELECT nickname FROM users WHERE id=?').get(f.context.ownerId).nickname,
      '目标老师'
    )
    assert.equal(
      f.db.prepare("SELECT actorId FROM audit_logs WHERE action='PROFILE_CHANGE'").get().actorId,
      f.admin.actor.id
    )
    const appearanceKey = randomUUID()
    const appearance = await f.request(
      '/me/appearance',
      'PATCH',
      { theme: 'green' },
      { 'idempotency-key': appearanceKey }
    )
    const repeated = await f.request(
      '/me/appearance',
      'PATCH',
      { theme: 'green' },
      { 'idempotency-key': appearanceKey }
    )
    assert.equal(repeated.statusCode, 200)
    assert.deepEqual(repeated.json(), appearance.json())
    assert.equal(
      (
        await f.request(
          '/me/appearance',
          'PATCH',
          { theme: 'purple' },
          { 'idempotency-key': appearanceKey }
        )
      ).statusCode,
      409
    )
    assert.equal(appearance.statusCode, 200, appearance.body)
    assert.equal((await f.request('/me/appearance')).json().theme, 'green')
    assert.equal(
      (
        await f.app.inject({
          url: '/api/v1/me/appearance',
          headers: { authorization: `Bearer ${f.admin.token}` }
        })
      ).json().theme,
      'bluepink'
    )
    assert.equal(
      (await f.request('/me/devices')).json().every((item) => !item.current),
      true
    )
  } finally {
    await f.close()
  }
})

test('代管令牌不能跨设备或被普通账号盗用；切换失败保留上下文，结束后仍保留双方登录', async () => {
  const f = await managedFixture()
  try {
    assert.equal(
      (
        await f.request('/me/context', 'GET', undefined, {
          authorization: `Bearer ${f.teacher.token}`
        })
      ).statusCode,
      403
    )
    const other = f.actor('ADMIN')
    assert.equal(
      (await f.request('/me/context', 'GET', undefined, { authorization: `Bearer ${other.token}` }))
        .statusCode,
      403
    )
    const invalid = await f.app.inject({
      url: '/api/v1/me/managed-session',
      method: 'POST',
      headers: { authorization: `Bearer ${f.admin.token}` },
      payload: { ownerId: randomUUID() }
    })
    assert.equal(invalid.statusCode, 400)
    assert.equal((await f.request('/me/context')).statusCode, 200)
    const end = await f.app.inject({
      url: '/api/v1/me/managed-session',
      method: 'DELETE',
      headers: { authorization: `Bearer ${f.admin.token}` }
    })
    assert.equal(end.statusCode, 200)
    assert.equal((await f.request('/me/context')).statusCode, 403)
    for (const ctx of [f.admin, f.teacher])
      assert.equal(
        (
          await f.app.inject({
            url: '/api/v1/auth/me',
            headers: { authorization: `Bearer ${ctx.token}` }
          })
        ).statusCode,
        200
      )
  } finally {
    await f.close()
  }
})

test('目标禁用、改密版本、管理员撤销资格及设备撤销使代管即时失效，异步提交也复验', async () => {
  const f = await managedFixture()
  try {
    for (const [sql, undo] of [
      [
        "UPDATE users SET status='DISABLED' WHERE id=?",
        "UPDATE users SET status='ACTIVE' WHERE id=?"
      ],
      [
        'UPDATE users SET authVersion=authVersion+1 WHERE id=?',
        'UPDATE users SET authVersion=authVersion-1 WHERE id=?'
      ]
    ]) {
      f.db.prepare(sql).run(f.context.ownerId)
      assert.equal((await f.request('/me/context')).json().code, 'MANAGED_SESSION_INVALID')
      assert.throws(
        () => validateContext(f.db, f.context),
        (error) => error.code === 'MANAGED_SESSION_INVALID'
      )
      f.db.prepare(undo).run(f.context.ownerId)
    }
    f.db.prepare('UPDATE users SET superVip=0 WHERE id=?').run(f.admin.actor.id)
    assert.equal((await f.request('/workspaces')).statusCode, 403)
    assert.throws(
      () => validateContext(f.db, f.context),
      (error) => error.code === 'MANAGED_SESSION_INVALID'
    )
    f.db.prepare('UPDATE users SET superVip=1 WHERE id=?').run(f.admin.actor.id)
    f.db.prepare('UPDATE auth_sessions SET revoked=1 WHERE id=?').run(f.admin.sessionId)
    assert.equal((await f.request('/me/context')).statusCode, 401)
    assert.throws(
      () => validateContext(f.db, f.context),
      (error) => error.code === 'UNAUTHENTICATED'
    )
  } finally {
    await f.close()
  }
})

test('目标改密需目标当前密码，成功仅撤销目标登录，审计保留管理员', async () => {
  const f = await managedFixture()
  try {
    f.db
      .prepare('UPDATE users SET passwordHash=? WHERE id=?')
      .run(await hashPassword('TeacherOldPass1'), f.context.ownerId)
    const wrong = await f.request('/me/password', 'POST', {
      currentPassword: 'AdminPassword1',
      newPassword: 'TeacherNextPass1'
    })
    assert.equal(wrong.json().code, 'PASSWORD_MISMATCH')
    const success = await f.request('/me/password', 'POST', {
      currentPassword: 'TeacherOldPass1',
      newPassword: 'TeacherNextPass1'
    })
    assert.equal(success.statusCode, 200, success.body)
    assert.equal((await f.request('/me/context')).json().code, 'MANAGED_SESSION_INVALID')
    assert.equal(
      (
        await f.app.inject({
          url: '/api/v1/auth/me',
          headers: { authorization: `Bearer ${f.admin.token}` }
        })
      ).statusCode,
      200
    )
    assert.equal(
      (
        await f.app.inject({
          url: '/api/v1/auth/me',
          headers: { authorization: `Bearer ${f.teacher.token}` }
        })
      ).statusCode,
      401
    )
    assert.equal(
      f.db.prepare("SELECT actorId,ownerId FROM audit_logs WHERE action='PASSWORD_CHANGE'").get()
        .actorId,
      f.admin.actor.id
    )
  } finally {
    await f.close()
  }
})

test('代管 AI 使用老师 Key 与额度，管理员 Key 与余额不变；审计真实操作者', async () => {
  const previous = process.env.AI_ENCRYPTION_KEY
  process.env.AI_ENCRYPTION_KEY = randomBytes(32).toString('base64')
  const f = await managedFixture()
  try {
    const config = {
      provider: 'OPENAI',
      baseUrl: 'https://models.example.test/v1',
      model: 'test-model',
      enabled: true,
      version: 0,
      apiKey: 'platform-test-key'
    }
    saveAIConfig(f.db, f.admin, config, true, randomUUID(), 'platform')
    const teacher = f.teacher
    saveAIConfig(
      f.db,
      teacher,
      { ...config, apiKey: 'teacher-test-key' },
      false,
      randomUUID(),
      'personal'
    )
    saveAIMode(f.db, teacher, { mode: 'PERSONAL', version: 0 }, randomUUID(), 'mode')
    let suppliedKey
    const invoke = async (input) => {
      suppliedKey = input.key
      return { text: '成功', inputTokens: 12, outputTokens: 3 }
    }
    await runAICall(f.db, f.context, { scene: 'test', prompt: '' }, randomUUID(), 'ai', '', invoke)
    assert.equal(suppliedKey, 'teacher-test-key')
    saveAIMode(f.db, teacher, { mode: 'PLATFORM', version: 1 }, randomUUID(), 'mode')
    adjustAIQuota(
      f.db,
      f.admin,
      teacher.ownerId,
      { delta: 50000, version: 0, reason: '测试额度' },
      randomUUID(),
      'quota'
    )
    await runAICall(f.db, f.context, { scene: 'test', prompt: '' }, randomUUID(), 'ai', '', invoke)
    assert.equal(quotaFor(f.db, teacher.ownerId).used, 15)
    assert.equal(quotaFor(f.db, f.admin.ownerId).used, 0)
    const audit = f.db
      .prepare(
        "SELECT actorId,ownerId FROM audit_logs WHERE action='AI_CALL_CREATE' ORDER BY createdAt DESC LIMIT 1"
      )
      .get()
    assert.deepEqual(audit, { actorId: f.admin.ownerId, ownerId: teacher.ownerId })
    const publicSettings = await f.request('/me/ai')
    assert.equal(publicSettings.statusCode, 200)
    assert.ok(!publicSettings.body.includes('test-key'))
  } finally {
    await f.close()
    if (previous === undefined) delete process.env.AI_ENCRYPTION_KEY
    else process.env.AI_ENCRYPTION_KEY = previous
  }
})
