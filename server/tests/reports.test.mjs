import { test } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { fixture } from './helpers/scores.mjs'
import { readStudentReport, saveStudentReport } from '../dist/services/reports/documents.js'
import { readExamPrint, compareNames } from '../dist/services/printTools.js'
/** 报告只使用本期真实分数，保留零/缺失，保存正文须校验成绩与文档版本。 */
test('服务器报告、打印统计与重复姓名核对', () => {
  const f = fixture()
  try {
    const a = f.student('甲'),
      b = f.student('乙'),
      unit = f.assessment()
    f.write([{ studentId: a.studentId, assessmentId: unit.id, value: 0, expectedVersion: 0 }])
    const record = readStudentReport(f.db, f.context, f.workspace.id, a.studentId, [], 'read')
    assert.equal(record.report.scoreItems[0].score, 0)
    assert.equal(record.report.scoreItems[0].rank, 1)
    assert.throws(
      () => readStudentReport(f.db, f.context, f.workspace.id, b.studentId, [], 'missing'),
      (e) => e.code === 'NO_REPORT_SCORES'
    )
    const input = {
        text: '审核正文',
        version: 0,
        workspaceVersion: record.workspaceVersion,
        sourceVersion: record.sourceVersion,
        props: record.selectedProps
      },
      key = randomUUID()
    assert.equal(
      saveStudentReport(f.db, f.context, f.workspace.id, a.studentId, input, key, 'save').version,
      1
    )
    assert.equal(
      saveStudentReport(f.db, f.context, f.workspace.id, a.studentId, input, key, 'retry').version,
      1
    )
    assert.equal(
      readStudentReport(f.db, f.context, f.workspace.id, a.studentId, [], 'fresh').needsReview,
      false
    )
    f.db
      .prepare("INSERT INTO business_resources VALUES(?,'tags',?,?,?, ?,1,NULL,?)")
      .run(
        f.context.ownerId,
        f.workspace.id,
        f.workspace.id,
        '标签',
        JSON.stringify({
          categories: ['优点'],
          tags: { 优点: ['认真'] },
          assignments: { [a.studentId]: ['认真'] }
        }),
        Date.now()
      )
    assert.equal(
      readStudentReport(f.db, f.context, f.workspace.id, a.studentId, [], 'tag-change').needsReview,
      true
    )
    assert.throws(
      () =>
        saveStudentReport(
          f.db,
          f.context,
          f.workspace.id,
          a.studentId,
          { ...input, version: 1 },
          randomUUID(),
          'stale-tags'
        ),
      (e) => e.code === 'VERSION_CONFLICT'
    )
    assert.throws(
      () => readStudentReport(f.db, f.actor(), f.workspace.id, a.studentId, [], 'foreign'),
      (e) => e.statusCode === 404
    )
    f.write([{ studentId: a.studentId, assessmentId: unit.id, value: 80, expectedVersion: 1 }])
    assert.throws(
      () =>
        saveStudentReport(
          f.db,
          f.context,
          f.workspace.id,
          a.studentId,
          { ...input, version: 1 },
          randomUUID(),
          'stale'
        ),
      (e) => e.code === 'VERSION_CONFLICT'
    )
    assert.equal(
      readStudentReport(f.db, f.context, f.workspace.id, a.studentId, [], 'changed').needsReview,
      true
    )
    const exam = readExamPrint(f.db, f.context, f.workspace.id, unit.id, 'print')
    assert.equal(exam.valid, 1)
    assert.equal(exam.missing, 1)
    assert.equal(exam.average, 80)
    assert.deepEqual(compareNames(['甲', '甲', '乙'], ['甲', '丙']), {
      matched: ['甲'],
      baselineOnly: ['甲', '乙'],
      comparisonOnly: ['丙']
    })
  } finally {
    f.db.close()
  }
})
