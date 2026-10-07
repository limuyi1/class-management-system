import { createWorkspace } from '../dist/services/workspaces.js'
import { previewV5State } from '../dist/services/v5/preview.js'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { fixture } from './helpers/scores.mjs'
import { readV5State } from '../dist/services/v5/state.js'
import { writeV5State } from '../dist/services/v5/write.js'
import { buildApp } from '../dist/app.js'

test('原页面状态写入规范表，零分空值/标签/评语保留，旧指纹及非法状态整批拒绝', () => {
  const f = fixture()
  try {
    const student = f.student('同名'),
      second = f.student('同名'),
      column = f.assessment()
    const before = readV5State(f.db, f.context, f.workspace.id)
    const students = before.stores.dataSource.students.map((row) => ({
      ...row,
      unit1: row.studentId === student.studentId ? 0 : null,
      comment: row.studentId === student.studentId ? '认真学习' : '',
      tags: { habit: ['认真'] }
    }))
    const stores = {
      dataSource: { students },
      setting: {
        ...before.stores.setting,
        tagCategories: [{ prop: 'habit', label: '习惯' }],
        tags: { habit: ['认真'] }
      }
    }
    const key = randomUUID()
    const receipts = f.db.prepare('SELECT count(*) AS count FROM mutation_receipts').get().count
    previewV5State(
      f.db,
      f.context,
      f.workspace.id,
      { fingerprint: before.fingerprint, stores },
      randomUUID(),
      'preview'
    )
    assert.equal(readV5State(f.db, f.context, f.workspace.id).fingerprint, before.fingerprint)
    assert.equal(
      f.db.prepare('SELECT count(*) AS count FROM mutation_receipts').get().count,
      receipts
    )
    const result = writeV5State(
      f.db,
      f.context,
      f.workspace.id,
      { fingerprint: before.fingerprint, stores },
      key,
      'save'
    )
    assert.equal(f.read().scores.find((row) => row.studentId === student.studentId).value, 0)
    assert.equal(
      result.stores.dataSource.students.find((row) => row.studentId === second.studentId).unit1,
      null
    )
    assert.equal(result.stores.dataSource.students[0].comment, '认真学习')
    assert.deepEqual(result.stores.dataSource.students[0].tags, { habit: ['认真'] })
    assert.deepEqual(
      writeV5State(
        f.db,
        f.context,
        f.workspace.id,
        { fingerprint: before.fingerprint, stores },
        key,
        'retry'
      ),
      result
    )
    f.write([
      { studentId: student.studentId, assessmentId: column.id, value: 50, expectedVersion: 1 }
    ])
    assert.throws(
      () =>
        writeV5State(
          f.db,
          f.context,
          f.workspace.id,
          { fingerprint: result.fingerprint, stores },
          randomUUID(),
          'stale'
        ),
      (error) => error.code === 'VERSION_CONFLICT'
    )
    const latest = readV5State(f.db, f.context, f.workspace.id)
    const invalid = structuredClone(latest.stores.dataSource)
    invalid.students[0].name = '将回滚的姓名'
    invalid.students[0].unit1 = '无效分数'
    assert.throws(
      () =>
        writeV5State(
          f.db,
          f.context,
          f.workspace.id,
          { fingerprint: latest.fingerprint, stores: { dataSource: invalid } },
          randomUUID(),
          'invalid'
        ),
      (error) => error.code === 'INVALID_SCORE'
    )
    assert.equal(f.read().students[0].name, '同名')
    assert.throws(
      () =>
        writeV5State(
          f.db,
          f.context,
          f.workspace.id,
          { fingerprint: latest.fingerprint, stores: { aiConfig: { apiKey: 'forbidden' } } },
          randomUUID(),
          'secret'
        ),
      (error) => error.code === 'INVALID_INPUT'
    )
  } finally {
    f.db.close()
  }
})
test('管理员本人没有教学或个人 AI；普通用户不能访问平台管理，代管另行受会话验证', async () => {
  const f = fixture(),
    admin = f.actor('ADMIN'),
    app = await buildApp(f.db, 'http://localhost')
  try {
    for (const url of [
      '/workspaces',
      '/resources?kind=paper',
      '/attachments',
      '/me/ai',
      `/v5/workspaces/${f.workspace.id}`
    ]) {
      const result = await app.inject({
        method: 'GET',
        url: `/api/v1${url}`,
        headers: { authorization: `Bearer ${admin.token}` }
      })
      assert.equal(result.statusCode, 403, url)
    }
    assert.equal(
      (
        await app.inject({
          method: 'GET',
          url: '/api/v1/admin/ai/quotas',
          headers: { authorization: `Bearer ${f.context.token}` }
        })
      ).statusCode,
      403
    )
    assert.equal(
      (
        await app.inject({
          method: 'GET',
          url: `/api/v1/v5/workspaces/${f.workspace.id}`,
          headers: { authorization: `Bearer ${f.context.token}` }
        })
      ).statusCode,
      200
    )
  } finally {
    await app.close()
    f.db.close()
  }
})

test('原页面新增学生/测评、名单顺序和账号设置可重载；并发首次初始化只有默认工作区', async () => {
  const f = fixture(),
    context = f.actor(),
    app = await buildApp(f.db, 'http://localhost')
  try {
    const headers = { authorization: `Bearer ${context.token}`, 'idempotency-key': randomUUID() }
    const first = await app.inject({ method: 'POST', url: '/api/v1/v5/default-workspace', headers })
    assert.equal(first.statusCode, 200)
    const second = await app.inject({
      method: 'POST',
      url: '/api/v1/v5/default-workspace',
      headers: { ...headers, 'idempotency-key': randomUUID() }
    })
    assert.equal(first.json().id, second.json().id)
    const id = first.json().id,
      studentId = randomUUID(),
      otherId = randomUUID()
    const before = readV5State(f.db, context, id)
    writeV5State(
      f.db,
      context,
      id,
      {
        fingerprint: before.fingerprint,
        stores: {
          dataSource: {
            students: [
              { studentId, name: '一', unit1: 90 },
              { studentId: otherId, name: '二', unit1: 0 }
            ]
          },
          setting: {
            scoreColumns: [
              { prop: 'name', label: '姓名' },
              { prop: 'unit1', label: '第一单元', fullMark: 100 }
            ]
          },
          configuration: {
            scoreFullMark: 100,
            fontSize: 18,
            menuCollapsed: true,
            inputScoreTab: 'unit1',
            recentScoreEntries: { unit1: [] }
          },
          aiConfig: { prompts: { singleComment: '保留原提示词' } },
          tools: { cardTemplates: [], paperLayout: { columns: 2 } }
        }
      },
      randomUUID(),
      'create-original'
    )
    let saved = readV5State(f.db, context, id)
    assert.equal(saved.stores.aiConfig.prompts.singleComment, '保留原提示词')
    assert.equal(saved.stores.configuration.menuCollapsed, true)
    const otherPeriod = createWorkspace(
      f.db,
      context,
      { className: '404', termName: '下学期' },
      randomUUID(),
      'new-period'
    )
    const otherPreferences = readV5State(f.db, context, otherPeriod.id).stores.configuration
    assert.equal(otherPreferences.inputScoreTab, null)
    assert.deepEqual(otherPreferences.recentScoreEntries, {})
    assert.equal(otherPreferences.fontSize, 18)
    assert.equal(saved.stores.tools.paperLayout.columns, 2)
    writeV5State(
      f.db,
      context,
      id,
      {
        fingerprint: saved.fingerprint,
        stores: { dataSource: { students: saved.stores.dataSource.students.reverse() } }
      },
      randomUUID(),
      'reorder'
    )
    saved = readV5State(f.db, context, id)
    assert.equal(saved.stores.dataSource.students[0].studentId, otherId)
    assert.equal(saved.stores.dataSource.students[0].unit1, 0)
  } finally {
    await app.close()
    f.db.close()
  }
})
