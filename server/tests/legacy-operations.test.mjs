import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fixture } from './helpers/scores.mjs'
import { importLegacy } from '../dist/migration/importLegacy.js'
import { convertExcel } from '../dist/services/excel.js'
import { buildApp } from '../dist/app.js'

function backup(score = 0) {
  return {
    formatName: 'dexie',
    formatVersion: 1,
    data: {
      data: [
        {
          tableName: 'student_dataset',
          inbound: true,
          rows: {
            $: [{ id: 'main', students: [{ studentId: 'old-id', name: '学生甲', unit1: score }] }]
          }
        },
        {
          tableName: 'score_settings',
          inbound: true,
          rows: [
            {
              id: 'main',
              scoreColumns: [
                { prop: 'name', label: '姓名' },
                { prop: 'unit1', label: '第一单元' }
              ]
            }
          ]
        }
      ]
    }
  }
}
/** 迁移只操作测试空账号，验证预览回滚、零分和无效备份原子拒绝。 */
test('V4 Typeson 备份预览、导入和损坏数据回滚', () => {
  const f = fixture(),
    context = f.actor(),
    directory = mkdtempSync(join(tmpdir(), 'cms-migration-test-'))
  try {
    const preview = importLegacy(f.db, context.ownerId, backup(), directory, true)
    assert.equal(preview.workspaces, 1)
    assert.equal(
      f.db.prepare('SELECT count(*) AS n FROM workspaces WHERE ownerId=?').get(context.ownerId).n,
      0
    )
    assert.throws(() => importLegacy(f.db, context.ownerId, backup(101), directory), /无效成绩/)
    assert.equal(
      f.db.prepare('SELECT count(*) AS n FROM workspaces WHERE ownerId=?').get(context.ownerId).n,
      0
    )
    const report = importLegacy(f.db, context.ownerId, backup(), directory)
    assert.equal(report.scores, 1)
    assert.equal(
      f.db.prepare('SELECT value FROM scores WHERE ownerId=?').get(context.ownerId).value,
      0
    )
    assert.throws(() => importLegacy(f.db, context.ownerId, backup(), directory), /非空/)
  } finally {
    f.db.close()
    rmSync(directory, { recursive: true, force: true })
  }
})

test('Excel Worker 往返保持数值、空值及公式样式文本', async () => {
  const rows = [
    ['姓名', '成绩'],
    ['=1+1', 0],
    ['甲', null]
  ]
  const written = await convertExcel('write', rows)
  const read = await convertExcel('read', written.bytes)
  assert.deepEqual(read.rows, rows)
})

test('OpenAPI 实际路由文档受认证保护', async () => {
  const f = fixture(),
    app = await buildApp(f.db, 'http://localhost:5173')
  try {
    assert.equal((await app.inject('/api/v1/openapi.json')).statusCode, 401)
    const response = await app.inject({
      url: '/api/v1/openapi.json',
      headers: { authorization: `Bearer ${f.context.token}` }
    })
    assert.equal(response.statusCode, 200)
    assert.ok(response.json().paths['/api/v1/ai/calls'])
  } finally {
    await app.close()
    f.db.close()
  }
})

/** ZIP 展开预算先于第三方解析，伪造超大条目直接拒绝。 */
test('XLSX ZIP 容量上限拒绝压缩炸弹声明', async () => {
  const { validateExcelArchive } = await import('../dist/services/excelArchive.js')
  const archive = Buffer.from((await convertExcel('write', [['姓名'], ['甲']])).bytes)
  const signature = archive.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02]))
  assert.ok(signature > 0)
  archive.writeUInt32LE(32 * 1024 * 1024, signature + 24)
  assert.throws(() => validateExcelArchive(archive), /容量超过/)
})

/** 活动学期以 main 表为准，历史快照保留原名单并建立长期身份参照。 */
test('V5 多学期迁移保留身份、历史参照与活动学期最新数据', () => {
  const f = fixture(),
    target = f.actor(),
    directory = mkdtempSync(join(tmpdir(), 'cms-v5-test-'))
  const studentId = '00000000-0000-4000-a000-000000000001'
  const setting = {
    scoreColumns: [
      { prop: 'name', label: '姓名' },
      { prop: 'unit1', label: '单元', fullMark: 100 }
    ],
    tags: { 优点: ['认真'] }
  }
  const table = (tableName, rows) => ({ tableName, inbound: true, rows })
  const value = {
    formatName: 'dexie',
    formatVersion: 1,
    data: {
      data: [
        table('workspaces', [
          {
            id: 'main',
            activePeriodId: 'new',
            periods: [
              { id: 'old', classId: 'same', className: '一班', termName: '上学期' },
              {
                id: 'new',
                classId: 'same',
                className: '一班',
                termName: '下学期',
                references: [{ periodId: 'old', prop: 'unit1' }]
              }
            ]
          }
        ]),
        table('workspace_snapshots', [
          {
            id: 'old',
            students: [
              { studentId, name: '甲', unit1: 0, comment: '旧评语' },
              { studentId: 'other', name: '甲', unit1: 80 }
            ],
            setting
          },
          { id: 'new', students: [{ studentId, name: '甲', unit1: 1 }], setting }
        ]),
        table('student_dataset', [
          {
            id: 'main',
            students: [{ studentId, name: '甲新名', unit1: 90, tags: { 优点: ['认真'] } }]
          }
        ]),
        table('score_settings', [{ id: 'main', ...setting }])
      ]
    }
  }
  try {
    const report = importLegacy(f.db, target.ownerId, value, directory)
    assert.equal(report.workspaces, 2)
    assert.equal(report.students, 3)
    assert.equal(report.idMap[`student:${studentId}`], studentId)
    const rows = f.db
      .prepare('SELECT value FROM scores WHERE ownerId=? ORDER BY value')
      .all(target.ownerId)
    assert.deepEqual(
      rows.map((row) => row.value),
      [0, 80, 90]
    )
    assert.equal(
      f.db
        .prepare('SELECT name FROM enrollments WHERE workspaceId=? AND studentId=?')
        .get(report.idMap.new, studentId).name,
      '甲新名'
    )
    assert.equal(
      f.db
        .prepare('SELECT count(*) AS n FROM workspace_references WHERE ownerId=?')
        .get(target.ownerId).n,
      1
    )
    assert.equal(
      f.db.prepare('SELECT text FROM comments WHERE ownerId=?').get(target.ownerId).text,
      '旧评语'
    )
    const tags = JSON.parse(
      f.db
        .prepare('SELECT contentJson FROM business_resources WHERE ownerId=? AND workspaceId=?')
        .get(target.ownerId, report.idMap.new).contentJson
    )
    assert.deepEqual(tags.assignments[studentId], ['认真'])
  } finally {
    f.db.close()
    rmSync(directory, { recursive: true, force: true })
  }
})

/** 外部通知单不能丢弃，也不能把独立五科成绩写进当前测评。 */
test('迁移独立通知完整留档且接口按账号隔离', async () => {
  const f = fixture(),
    target = f.actor(),
    directory = mkdtempSync(join(tmpdir(), 'cms-notice-test-'))
  const original = {
    title: '期末通知',
    noticeDate: '2026-07-11',
    mode: 'grade',
    subjects: [
      {
        id: 'math',
        label: '数学',
        sourceColumn: '数学',
        rule: { maxScore: 100, gradeAMin: 80, gradeBMin: 60 }
      }
    ],
    students: [
      {
        id: 'notice-a',
        name: '学生甲',
        rawValues: { math: 90 },
        gradeValues: { math: 'A' },
        comment: '独立通知评语',
        commentStatus: 'manual'
      }
    ]
  }
  const value = backup()
  value.data.data.push({
    tableName: 'score_notice',
    inbound: true,
    rows: [{ id: 'main', ...original }]
  })
  const app = await buildApp(f.db, 'http://localhost:5173')
  try {
    const report = importLegacy(f.db, target.ownerId, value, directory)
    const id = report.idMap['legacy-main']
    const url = `/api/v1/workspaces/${id}/legacy-notice`
    const response = await app.inject({ url, headers: { authorization: `Bearer ${target.token}` } })
    assert.equal(response.statusCode, 200)
    assert.deepEqual(response.json().notice, { id: 'main', ...original })
    assert.equal(
      (await app.inject({ url, headers: { authorization: `Bearer ${f.context.token}` } }))
        .statusCode,
      404
    )
    assert.equal(
      f.db.prepare('SELECT count(*) AS n FROM assessments WHERE ownerId=?').get(target.ownerId).n,
      1
    )
    assert.equal(
      f.db.prepare('SELECT count(*) AS n FROM comments WHERE ownerId=?').get(target.ownerId).n,
      0
    )
  } finally {
    await app.close()
    f.db.close()
    rmSync(directory, { recursive: true, force: true })
  }
})
