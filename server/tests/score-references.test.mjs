/** 内存数据库验证，不操作用户数据或监听端口。 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { createWorkspace } from '../dist/services/workspaces.js'
import { editStudent } from '../dist/services/students.js'
import { createAssessment, deleteAssessment } from '../dist/services/assessments.js'
import { writeScores } from '../dist/services/scores.js'
import { setReferences } from '../dist/services/scoreReferences.js'
import { fixture } from './helpers/scores.mjs'

test('新学期沿用配置和学生 ID，不复制成绩；历史排名用源名单并列排名，不混入本期统计', () => {
  const f = fixture()
  try {
    const one = f.student('同名'),
      two = f.student('同名'),
      absent = f.student('未升入'),
      column = f.assessment()
    f.write([
      { studentId: one.studentId, assessmentId: column.id, value: 80, expectedVersion: 0 },
      { studentId: two.studentId, assessmentId: column.id, value: 80, expectedVersion: 0 },
      { studentId: absent.studentId, assessmentId: column.id, value: 100, expectedVersion: 0 }
    ])
    editStudent(
      f.db,
      f.context,
      f.workspace.id,
      absent.studentId,
      { name: absent.name, disabled: false, departed: true, version: 1 },
      randomUUID(),
      'depart'
    )
    const next = f.promote()
    const current = f.read(next.id)
    assert.equal(current.students.length, 2)
    assert.equal(current.assessments[0].prop, column.prop)
    assert.notEqual(current.assessments[0].id, column.id)
    assert.deepEqual(current.scores, [])
    setReferences(
      f.db,
      f.context,
      next.id,
      {
        version: current.workspace.version,
        items: [{ sourceWorkspaceId: f.workspace.id, assessmentId: column.id }]
      },
      randomUUID(),
      'references'
    )
    const projected = f.read(next.id)
    assert.equal(projected.references[0].scores.length, 2)
    assert.deepEqual(
      projected.references[0].scores.map((score) => score.rank),
      [2, 2]
    )
    assert.equal(projected.statistics[0].count, 0)
    assert.equal(projected.statistics[0].missing, 2)
    assert.equal(projected.statistics[0].average, null)
    assert.deepEqual(projected.scores, [])
    assert.throws(
      () => deleteAssessment(f.db, f.context, f.workspace.id, column.id, 1, randomUUID(), 'delete'),
      (error) => error.code === 'ASSESSMENT_REFERENCED'
    )
    assert.throws(
      () =>
        writeScores(
          f.db,
          f.context,
          next.id,
          [{ studentId: one.studentId, assessmentId: column.id, value: 5, expectedVersion: 1 }],
          randomUUID(),
          'history-write'
        ),
      /测评不存在/
    )
  } finally {
    f.db.close()
  }
})

test('跨账号、跨班、当前学期参照和成绩复合外键不能绕过', () => {
  const f = fixture()
  try {
    const student = f.student('甲'),
      column = f.assessment(),
      other = f.actor()
    const foreign = createWorkspace(
      f.db,
      other,
      { className: '外班', termName: '2026上' },
      randomUUID(),
      'foreign'
    )
    const foreignColumn = createAssessment(
      f.db,
      other,
      foreign.id,
      { label: '外测评', fullMark: 150, disabled: false, sortIndex: 0 },
      randomUUID(),
      'foreign-column'
    )
    assert.throws(
      () =>
        f.write([
          {
            studentId: student.studentId,
            assessmentId: foreignColumn.id,
            value: 100,
            expectedVersion: 0
          }
        ]),
      /测评不存在/
    )
    assert.throws(
      () =>
        setReferences(
          f.db,
          f.context,
          f.workspace.id,
          {
            version: f.read().workspace.version,
            items: [{ sourceWorkspaceId: foreign.id, assessmentId: foreignColumn.id }]
          },
          randomUUID(),
          'cross'
        ),
      /班级学期不存在/
    )
    assert.throws(
      () =>
        setReferences(
          f.db,
          f.context,
          f.workspace.id,
          {
            version: f.read().workspace.version,
            items: [{ sourceWorkspaceId: f.workspace.id, assessmentId: column.id }]
          },
          randomUUID(),
          'self'
        ),
      /本班其他学期/
    )
    assert.throws(
      () =>
        f.db
          .prepare(
            'INSERT INTO scores(workspaceId,ownerId,studentId,assessmentId,value) VALUES(?,?,?,?,?)'
          )
          .run(f.workspace.id, f.context.ownerId, student.studentId, foreignColumn.id, 100),
      /FOREIGN KEY/
    )
    const differentClass = createWorkspace(
      f.db,
      f.context,
      { className: '304', termName: '2026上' },
      randomUUID(),
      'other-class'
    )
    assert.throws(
      () =>
        setReferences(
          f.db,
          f.context,
          differentClass.id,
          { version: 1, items: [{ sourceWorkspaceId: f.workspace.id, assessmentId: column.id }] },
          randomUUID(),
          'wrong-class'
        ),
      /本班其他学期/
    )
  } finally {
    f.db.close()
  }
})
