import { test } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { fixture } from './helpers/scores.mjs'
import { writeComments, readComments } from '../dist/services/comments.js'
import { readTeachingSnapshot } from '../dist/services/notice.js'
import { createWorkspace } from '../dist/services/workspaces.js'
import { transferStudent } from '../dist/services/rosterLifecycle.js'
import { deleteStudent } from '../dist/services/students.js'

/** 真实数据库检查评语版本、事务与隔离，不依赖前端隐藏按钮。 */
test('同名评语以 ID 独立保存，重复请求不重写，清空保留版本防止旧设备覆盖', () => {
  const f = fixture()
  try {
    const one = f.student('同名'),
      two = f.student('同名')
    const input = [{ studentId: one.studentId, text: '第一位同学的评语', expectedVersion: 0 }],
      key = randomUUID()
    writeComments(f.db, f.context, f.workspace.id, input, key, 'first')
    writeComments(f.db, f.context, f.workspace.id, input, key, 'retry')
    assert.deepEqual(readComments(f.db, f.context, f.workspace.id, 'read').comments, [
      { studentId: one.studentId, text: input[0].text, version: 1 }
    ])
    assert.equal(
      readComments(f.db, f.context, f.workspace.id, 'read').students.find(
        (item) => item.studentId === two.studentId
      ).name,
      '同名'
    )
    writeComments(
      f.db,
      f.context,
      f.workspace.id,
      [{ studentId: one.studentId, text: '', expectedVersion: 1 }],
      randomUUID(),
      'clear'
    )
    const current = readComments(f.db, f.context, f.workspace.id, 'read').comments[0]
    assert.equal(current.text, '')
    assert.equal(current.version, 2)
    assert.ok(f.db.prepare('SELECT deletedAt FROM comments').get().deletedAt)
    assert.equal(f.db.prepare('SELECT text FROM comments').get().text, input[0].text)
    assert.throws(
      () => writeComments(f.db, f.context, f.workspace.id, input, randomUUID(), 'stale'),
      (error) =>
        error.code === 'VERSION_CONFLICT' && error.details.conflicts[0].current.version === 2
    )
  } finally {
    f.db.close()
  }
})
test('评语整批冲突回滚，其他账号学生不可写，转班目标和新学期不复制评语', () => {
  const f = fixture()
  try {
    const one = f.student('甲'),
      two = f.student('乙')
    writeComments(
      f.db,
      f.context,
      f.workspace.id,
      [{ studentId: one.studentId, text: '原评语', expectedVersion: 0 }],
      randomUUID(),
      'first'
    )
    assert.throws(
      () =>
        writeComments(
          f.db,
          f.context,
          f.workspace.id,
          [
            { studentId: two.studentId, text: '不应写入', expectedVersion: 0 },
            { studentId: one.studentId, text: '旧设备', expectedVersion: 0 }
          ],
          randomUUID(),
          'conflict'
        ),
      /整个批次/
    )
    assert.equal(f.db.prepare('SELECT count(*) AS count FROM comments').get().count, 1)
    const other = f.actor()
    assert.throws(
      () =>
        writeComments(
          f.db,
          other,
          f.workspace.id,
          [{ studentId: one.studentId, text: '越权', expectedVersion: 0 }],
          randomUUID(),
          'cross'
        ),
      /不存在/
    )
    const next = f.promote()
    assert.deepEqual(readTeachingSnapshot(f.db, f.context, next.id, 'next').comments, [])
    const target = createWorkspace(
      f.db,
      f.context,
      { className: '304', termName: '2026上' },
      randomUUID(),
      'target'
    )
    transferStudent(
      f.db,
      f.context,
      f.workspace.id,
      { studentId: one.studentId, targetId: target.id, version: 1 },
      randomUUID(),
      'transfer'
    )
    assert.deepEqual(readTeachingSnapshot(f.db, f.context, target.id, 'target-read').comments, [])
    assert.throws(
      () =>
        writeComments(
          f.db,
          f.context,
          f.workspace.id,
          [{ studentId: one.studentId, text: '转出不可改', expectedVersion: 1 }],
          randomUUID(),
          'readonly'
        ),
      /不可编辑/
    )
    deleteStudent(f.db, f.context, f.workspace.id, one.studentId, 2, randomUUID(), 'delete')
    assert.deepEqual(readComments(f.db, f.context, f.workspace.id, 'read').comments, [])
    assert.equal(f.db.prepare('SELECT text FROM comments').get().text, '原评语')
  } finally {
    f.db.close()
  }
})
