/** 内存数据库验证，不操作用户数据或监听端口。 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { createWorkspace } from '../dist/services/workspaces.js'
import { deleteStudent } from '../dist/services/students.js'
import { createAssessment, deleteAssessment, editAssessment } from '../dist/services/assessments.js'
import { transferStudent } from '../dist/services/rosterLifecycle.js'
import { fixture } from './helpers/scores.mjs'

test('零分、未录入和清空分别保留；清空递增版本，批次幂等且不补零', () => {
  const f = fixture()
  try {
    const one = f.student('零分'),
      two = f.student('未录入'),
      column = f.assessment()
    const change = {
      studentId: one.studentId,
      assessmentId: column.id,
      value: 0,
      expectedVersion: 0
    }
    const key = randomUUID()
    assert.equal(f.write([change], key).items[0].version, 1)
    assert.equal(f.write([change], key).items[0].version, 1)
    const state = f.read()
    assert.equal(state.scores.length, 1)
    assert.equal(state.scores[0].value, 0)
    assert.equal(
      state.scores.some((score) => score.studentId === two.studentId),
      false
    )
    assert.deepEqual(state.statistics[0], {
      assessmentId: column.id,
      count: 1,
      missing: 1,
      average: 0,
      min: 0,
      max: 0
    })
    f.write([{ ...change, value: null, expectedVersion: 1 }])
    assert.equal(f.read().scores[0].value, null)
    assert.equal(f.read().scores[0].version, 2)
    assert.throws(
      () => f.write([{ ...change, value: 77, expectedVersion: 1 }]),
      (error) =>
        error.code === 'VERSION_CONFLICT' && error.details.conflicts[0].current.version === 2
    )
  } finally {
    f.db.close()
  }
})

test('批量任意一格冲突均无部分写入，冲突提供最新值且不生成成功回执', () => {
  const f = fixture()
  try {
    const one = f.student('甲'),
      two = f.student('乙'),
      column = f.assessment()
    f.write([{ studentId: one.studentId, assessmentId: column.id, value: 10, expectedVersion: 0 }])
    const receipts = f.db.prepare('SELECT count(*) AS count FROM mutation_receipts').get().count
    assert.throws(
      () =>
        f.write([
          { studentId: two.studentId, assessmentId: column.id, value: 100, expectedVersion: 0 },
          { studentId: one.studentId, assessmentId: column.id, value: 20, expectedVersion: 0 }
        ]),
      (error) =>
        error.code === 'VERSION_CONFLICT' && error.details.conflicts[0].current.value === 10
    )
    assert.equal(f.read().scores.length, 1)
    assert.equal(f.read().scores[0].value, 10)
    assert.equal(
      f.db.prepare('SELECT count(*) AS count FROM mutation_receipts').get().count,
      receipts
    )
    const duplicate = {
      studentId: two.studentId,
      assessmentId: column.id,
      value: 1,
      expectedVersion: 0
    }
    assert.throws(() => f.write([duplicate, duplicate]), /重复单元格/)
    assert.throws(() => f.write([{ ...duplicate, value: Number.NaN }]), /有效数值/)
  } finally {
    f.db.close()
  }
})

test('禁用/转出不可录入且不统计，转班目标成绩为空，软删除保留原始分', () => {
  const f = fixture()
  try {
    const student = f.student('甲'),
      column = f.assessment()
    f.write([
      { studentId: student.studentId, assessmentId: column.id, value: 101, expectedVersion: 0 }
    ])
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
      { studentId: student.studentId, targetId: target.id, version: 1 },
      randomUUID(),
      'transfer'
    )
    assert.equal(f.read().scores[0].value, 101)
    assert.equal(f.read().statistics[0].count, 0)
    assert.deepEqual(f.read(target.id).scores, [])
    assert.throws(
      () =>
        f.write([
          { studentId: student.studentId, assessmentId: column.id, value: 8, expectedVersion: 1 }
        ]),
      (error) => error.code === 'SCORE_READ_ONLY'
    )
    deleteStudent(f.db, f.context, f.workspace.id, student.studentId, 2, randomUUID(), 'delete')
    assert.deepEqual(f.read().scores, [])
    assert.equal(
      f.db.prepare('SELECT value FROM scores WHERE workspaceId=?').get(f.workspace.id).value,
      101
    )
    deleteAssessment(f.db, f.context, f.workspace.id, column.id, 1, randomUUID(), 'delete-column')
    assert.equal(f.db.prepare('SELECT count(*) AS count FROM scores').get().count, 1)
  } finally {
    f.db.close()
  }
})

test('测评名称/满分/排序使用版本检查，默认满分回退和原始分不受影响', () => {
  const f = fixture()
  try {
    const column = f.assessment(),
      student = f.student('甲')
    f.write([
      { studentId: student.studentId, assessmentId: column.id, value: 80, expectedVersion: 0 }
    ])
    const changed = editAssessment(
      f.db,
      f.context,
      f.workspace.id,
      column.id,
      { label: '更名', fullMark: 150, disabled: true, sortIndex: 5, version: 1 },
      randomUUID(),
      'edit'
    )
    assert.equal(changed.version, 2)
    assert.throws(
      () =>
        editAssessment(
          f.db,
          f.context,
          f.workspace.id,
          column.id,
          { ...changed, label: '旧设备', version: 1 },
          randomUUID(),
          'stale'
        ),
      (error) => error.code === 'VERSION_CONFLICT' && error.details.current.label === '更名'
    )
    assert.equal(f.read().scores[0].value, 80)
    assert.deepEqual(f.read().statistics, [])
    assert.throws(
      () =>
        createAssessment(
          f.db,
          f.context,
          f.workspace.id,
          { prop: 'name', label: '姓名', fullMark: null, disabled: false, sortIndex: 0 },
          randomUUID(),
          'base'
        ),
      /基础字段/
    )
  } finally {
    f.db.close()
  }
})
