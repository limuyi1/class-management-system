/** 内存数据库验证，不操作用户数据或监听端口。 */
import { randomUUID } from 'node:crypto'
import SQLite from 'better-sqlite3'
import { migrate } from '../../dist/db/migrate.js'
import { authenticate, createSession } from '../../dist/auth/tokens.js'
import { createWorkspace } from '../../dist/services/workspaces.js'
import { addStudent } from '../../dist/services/students.js'
import { createAssessment } from '../../dist/services/assessments.js'
import { writeScores } from '../../dist/services/scores.js'
import { readScoreState } from '../../dist/services/scoreProjection.js'
import { promoteWorkspace } from '../../dist/services/rosterLifecycle.js'

export function fixture() {
  const db = new SQLite(':memory:')
  migrate(db)
  const actor = (role = 'USER') => {
    const id = randomUUID()
    db.prepare(
      "INSERT INTO users(id,phone,nickname,passwordHash,role,status,mustChangePassword,createdAt) VALUES(?,?,?,?,?,'ACTIVE',0,?)"
    ).run(
      id,
      `138${String(Math.floor(Math.random() * 1e8)).padStart(8, '0')}`,
      '测试老师',
      'hash',
      role,
      Date.now()
    )
    const account = db.prepare('SELECT * FROM users WHERE id=?').get(id)
    const token = createSession(db, account).accessToken
    const actor = authenticate(db, token)
    return { actor, ownerId: id, sessionId: actor.sessionId, token }
  }
  const context = actor()
  const workspace = createWorkspace(
    db,
    context,
    { className: '303', termName: '2026上' },
    randomUUID(),
    'create'
  )
  const student = (name) => addStudent(db, context, workspace.id, { name }, randomUUID(), 'student')
  const assessment = (prop = 'unit1') =>
    createAssessment(
      db,
      context,
      workspace.id,
      { prop, label: '第一单元', fullMark: null, disabled: false, sortIndex: 0 },
      randomUUID(),
      'assessment'
    )
  const write = (items, key = randomUUID()) =>
    writeScores(db, context, workspace.id, items, key, 'scores')
  const read = (id) => readScoreState(db, context, id || workspace.id, 'read')
  const promote = () =>
    promoteWorkspace(
      db,
      context,
      workspace.id,
      {
        className: '403',
        termName: '2026下',
        inheritStudents: true,
        inheritAssessments: true,
        version: read().workspace.version
      },
      randomUUID(),
      'promote'
    )
  return { db, actor, context, workspace, student, assessment, write, read, promote }
}
