import { test } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { fixture } from './helpers/scores.mjs'
import { saveNotice, readTeachingSnapshot } from '../dist/services/notice.js'
import { writeComments } from '../dist/services/comments.js'
import { buildApp } from '../dist/app.js'
import { createWorkspace } from '../dist/services/workspaces.js'
import { createAssessment } from '../dist/services/assessments.js'

function config(column) {
  return {
    title: '成绩通知',
    noticeDate: '2026-10-07',
    mode: 'score',
    subjects: [{ assessmentId: column.id, maxScore: 100, gradeAMin: 80, gradeBMin: 60 }]
  }
}
test('通知设置独立版本和幂等，导出包含已保存本期成绩、评语且记录真实操作者', () => {
  const f = fixture()
  try {
    const column = f.assessment(),
      student = f.student('甲'),
      key = randomUUID()
    const body = { expectedVersion: 0, config: config(column) }
    assert.equal(saveNotice(f.db, f.context, f.workspace.id, body, key, 'first').version, 1)
    assert.equal(saveNotice(f.db, f.context, f.workspace.id, body, key, 'retry').version, 1)
    assert.throws(
      () => saveNotice(f.db, f.context, f.workspace.id, body, randomUUID(), 'stale'),
      (error) => error.code === 'VERSION_CONFLICT' && error.details.current.version === 1
    )
    f.write([
      { studentId: student.studentId, assessmentId: column.id, value: 0, expectedVersion: 0 }
    ])
    writeComments(
      f.db,
      f.context,
      f.workspace.id,
      [{ studentId: student.studentId, text: '认真踏实', expectedVersion: 0 }],
      randomUUID(),
      'comment'
    )
    const admin = f.actor('ADMIN')
    f.db.prepare('UPDATE users SET superVip=1 WHERE id=?').run(admin.ownerId)
    const snapshot = readTeachingSnapshot(
      f.db,
      { ...admin, ownerId: f.context.ownerId },
      f.workspace.id,
      'export'
    )
    assert.equal(snapshot.scores.scores[0].value, 0)
    assert.equal(snapshot.comments[0].text, '认真踏实')
    assert.equal(snapshot.notice.config.title, '成绩通知')
    const audit = f.db
      .prepare("SELECT actorId,ownerId FROM audit_logs WHERE action='TEACHING_SNAPSHOT_READ'")
      .get()
    assert.deepEqual(audit, { actorId: admin.ownerId, ownerId: f.context.ownerId })
    f.db.prepare('UPDATE users SET superVip=0 WHERE id=?').run(admin.ownerId)
    assert.throws(
      () =>
        readTeachingSnapshot(
          f.db,
          { ...admin, ownerId: f.context.ownerId },
          f.workspace.id,
          'closed'
        ),
      /无权/
    )
  } finally {
    f.db.close()
  }
})
test('通知不允许其他账号/学期科目，等级线、真实日期和重复科目均后端校验', () => {
  const f = fixture()
  try {
    const column = f.assessment(),
      current = config(column)
    for (const changed of [
      { ...current, noticeDate: '2026-02-30' },
      { ...current, subjects: [current.subjects[0], current.subjects[0]] },
      { ...current, subjects: [{ ...current.subjects[0], gradeBMin: 90 }] }
    ])
      assert.throws(() =>
        saveNotice(
          f.db,
          f.context,
          f.workspace.id,
          { expectedVersion: 0, config: changed },
          randomUUID(),
          'bad'
        )
      )
    const next = f.promote(),
      nextColumn = readTeachingSnapshot(f.db, f.context, next.id, 'read').scores.assessments[0]
    assert.throws(
      () =>
        saveNotice(
          f.db,
          f.context,
          f.workspace.id,
          { expectedVersion: 0, config: config(nextColumn) },
          randomUUID(),
          'wrong-period'
        ),
      /测评不存在/
    )
    const other = f.actor(),
      workspace = createWorkspace(
        f.db,
        other,
        { className: '外班', termName: '2026上' },
        randomUUID(),
        'other'
      )
    const foreign = createAssessment(
      f.db,
      other,
      workspace.id,
      { label: '外测评', disabled: false, fullMark: null, sortIndex: 0 },
      randomUUID(),
      'foreign'
    )
    assert.throws(
      () =>
        saveNotice(
          f.db,
          f.context,
          f.workspace.id,
          { expectedVersion: 0, config: config(foreign) },
          randomUUID(),
          'cross'
        ),
      /测评不存在/
    )
  } finally {
    f.db.close()
  }
})
test('教学 HTTP 拒绝额外字段和跨账号导出，评语冲突返回脱敏明细', async () => {
  const f = fixture(),
    app = await buildApp(f.db, 'http://127.0.0.1:5173')
  try {
    const student = f.student('甲'),
      other = f.actor()
    const headers = { authorization: `Bearer ${f.context.token}`, 'idempotency-key': randomUUID() }
    const url = `/api/v1/workspaces/${f.workspace.id}/comments/batch`,
      body = { studentId: student.studentId, text: '保存文本', expectedVersion: 0 }
    assert.equal(
      (
        await app.inject({
          method: 'PATCH',
          url,
          headers,
          payload: { items: [{ ...body, role: 'ADMIN' }] }
        })
      ).statusCode,
      400
    )
    assert.equal(
      (await app.inject({ method: 'PATCH', url, headers, payload: { items: [body] } })).statusCode,
      200
    )
    const stale = await app.inject({
      method: 'PATCH',
      url,
      headers: { ...headers, 'idempotency-key': randomUUID() },
      payload: { items: [{ ...body, text: '旧设备' }] }
    })
    assert.equal(stale.statusCode, 409)
    assert.equal(stale.json().details.conflicts[0].current.text, '保存文本')
    assert.equal(
      (
        await app.inject({
          method: 'GET',
          url: `/api/v1/workspaces/${f.workspace.id}/exports/snapshot`,
          headers: { authorization: `Bearer ${other.token}` }
        })
      ).statusCode,
      404
    )
  } finally {
    await app.close()
    f.db.close()
  }
})
