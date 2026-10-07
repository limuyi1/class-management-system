import { test } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { fixture } from './helpers/scores.mjs'
import { buildApp } from '../dist/app.js'
import {
  deleteClassroomTool,
  readClassroomTools,
  saveClassroomTool
} from '../dist/services/classroomTools.js'

function chart(studentId = null) {
  const id = randomUUID()
  return {
    id,
    name: '测试方案',
    studentSource: 'system',
    rows: 1,
    columns: 1,
    aisleAfterColumns: [],
    firstColumnSide: 'left',
    platformPosition: 'top',
    seats: [{ row: 0, column: 0, studentId }],
    specialSeats: [],
    roleDefinitions: [],
    roleAssignments: [],
    notes: '',
    createdAt: '',
    updatedAt: ''
  }
}
function roster(studentId) {
  return {
    id: randomUUID(),
    name: '值日',
    studentSource: 'system',
    mode: 'daily',
    sections: [
      {
        id: 'room',
        name: '教室',
        kind: 'indoor',
        sortOrder: 0,
        positions: [{ id: 'desk', name: '桌子', sortOrder: 0 }]
      }
    ],
    weeklyRows: [],
    assignments: [{ period: 'monday', positionId: 'desk', studentIds: [studentId] }],
    leaders: [],
    notes: '',
    createdAt: '',
    updatedAt: ''
  }
}
test('方案独立版本、幂等重试、软删除与学期隔离', () => {
  const f = fixture()
  try {
    const student = f.student('同名学生')
    const content = chart(student.studentId)
    const input = { kind: 'seating', expectedVersion: 0, content }
    const key = randomUUID()
    const save = (
      body,
      requestKey = randomUUID(),
      context = f.context,
      workspaceId = f.workspace.id
    ) => saveClassroomTool(f.db, context, workspaceId, content.id, body, requestKey, 'test')
    const first = save(input, key)
    assert.equal(first.version, 1)
    assert.equal(first.content.id, content.id)
    assert.match(first.content.createdAt, /^\d{4}-/)
    assert.deepEqual(save(input, key), first)
    assert.throws(
      () => save(input),
      (error) => error.code === 'VERSION_CONFLICT'
    )
    const changed = save({ ...input, expectedVersion: 1, content: { ...content, name: '第二版' } })
    assert.equal(changed.version, 2)
    const next = f.promote()
    assert.equal(readClassroomTools(f.db, f.context, next.id, 'read').tools.length, 0)
    const other = f.actor()
    assert.throws(
      () => readClassroomTools(f.db, other, f.workspace.id, 'read'),
      (error) => error.statusCode === 404
    )
    deleteClassroomTool(f.db, f.context, f.workspace.id, content.id, 2, randomUUID(), 'delete')
    assert.equal(readClassroomTools(f.db, f.context, f.workspace.id, 'read').tools.length, 0)
    const raw = f.db.prepare('SELECT * FROM classroom_tools WHERE id=?').get(content.id)
    assert.ok(raw.deletedAt)
    assert.equal(JSON.parse(raw.contentJson).name, '第二版')
    assert.throws(
      () => save({ ...input, expectedVersion: 3 }),
      (error) => error.code === 'TOOL_DELETED'
    )
  } finally {
    f.db.close()
  }
})
test('外账号/停用学生、重复座位及无效值日岗位被拒绝，Excel 方案名单独立', () => {
  const f = fixture()
  try {
    const student = f.student('甲')
    const save = (kind, content) =>
      saveClassroomTool(
        f.db,
        f.context,
        f.workspace.id,
        content.id,
        { kind, content, expectedVersion: 0 },
        randomUUID(),
        'save'
      )
    assert.throws(() => save('seating', chart(randomUUID())), /学生/)
    const duplicated = chart(student.studentId)
    duplicated.columns = 2
    duplicated.seats.push({ row: 0, column: 1, studentId: student.studentId })
    assert.throws(() => save('seating', duplicated), /重复/)
    const invalidRoster = roster(student.studentId)
    invalidRoster.assignments[0].positionId = 'missing'
    assert.throws(() => save('duty', invalidRoster), /岗位/)
    const duty = save('duty', roster(student.studentId))
    assert.equal(duty.version, 1)
    f.db
      .prepare('UPDATE enrollments SET disabled=1 WHERE workspaceId=? AND studentId=?')
      .run(f.workspace.id, student.studentId)
    assert.throws(() => save('seating', chart(student.studentId)), /学生/)
    const external = chart('temporary-1')
    external.studentSource = 'excel'
    external.excelSource = { fileName: '名单.xlsx', students: [{ id: 'temporary-1', name: '甲' }] }
    assert.equal(save('seating', external).content.excelSource.students.length, 1)
    assert.equal(f.db.prepare('SELECT COUNT(*) AS total FROM enrollments').get().total, 1)
  } finally {
    f.db.close()
  }
})
test('工具 HTTP 白名单、防提权、代管撤权与审计', async () => {
  const f = fixture()
  const app = await buildApp(f.db, 'http://localhost:5173')
  try {
    const admin = f.actor('ADMIN')
    f.db.prepare('UPDATE users SET superVip=1 WHERE id=?').run(admin.actor.id)
    const content = chart()
    const headers = {
      authorization: `Bearer ${admin.token}`,
      'x-managed-account-id': f.context.ownerId,
      'idempotency-key': randomUUID()
    }
    const url = `/api/v1/workspaces/${f.workspace.id}/tools/${content.id}`
    const input = { kind: 'seating', expectedVersion: 0, content }
    let result = await app.inject({
      method: 'PUT',
      url,
      headers,
      payload: { ...input, ownerId: admin.ownerId }
    })
    assert.equal(result.statusCode, 400)
    result = await app.inject({
      method: 'PUT',
      url,
      headers,
      payload: { ...input, content: { ...content, role: 'ADMIN' } }
    })
    assert.equal(result.statusCode, 400)
    result = await app.inject({ method: 'PUT', url, headers, payload: input })
    assert.equal(result.statusCode, 200, result.body)
    const audit = f.db
      .prepare("SELECT actorId,ownerId FROM audit_logs WHERE action='CLASSROOM_TOOL_SAVE'")
      .get()
    assert.deepEqual(audit, { actorId: admin.actor.id, ownerId: f.context.ownerId })
    const ownHeaders = {
      authorization: `Bearer ${f.context.token}`,
      'x-managed-account-id': admin.ownerId
    }
    result = await app.inject({
      method: 'GET',
      url: `/api/v1/workspaces/${f.workspace.id}/tools`,
      headers: ownHeaders
    })
    assert.equal(result.statusCode, 403)
    f.db.prepare('UPDATE users SET superVip=0 WHERE id=?').run(admin.actor.id)
    result = await app.inject({ method: 'PUT', url, headers, payload: input })
    assert.equal(result.statusCode, 403)
  } finally {
    await app.close()
    f.db.close()
  }
})

test('同一区域允许多个在岗组长，拒绝不在岗、重复组长及过期容量', () => {
  const f = fixture()
  try {
    const a = f.student('甲').studentId
    const b = f.student('乙').studentId
    const content = roster(a)
    content.assignments[0].studentIds.push(b)
    content.leaders = [a, b].map((studentId) => ({
      period: 'monday',
      sectionId: 'room',
      studentId
    }))
    const save = (value) =>
      saveClassroomTool(
        f.db,
        f.context,
        f.workspace.id,
        value.id,
        { kind: 'duty', content: value, expectedVersion: 0 },
        randomUUID(),
        'save'
      )
    assert.equal(save(content).content.leaders.length, 2)
    const duplicate = {
      ...content,
      id: randomUUID(),
      leaders: [content.leaders[0], content.leaders[0]]
    }
    assert.throws(() => save(duplicate), /重复/)
    const absent = {
      ...content,
      id: randomUUID(),
      leaders: [{ period: 'tuesday', sectionId: 'room', studentId: a }]
    }
    assert.throws(() => save(absent), /必须已安排/)
    const invalidCapacity = { ...content, id: randomUUID(), autoAssignCapacities: { missing: 1 } }
    assert.throws(() => save(invalidCapacity), /岗位格/)
  } finally {
    f.db.close()
  }
})
