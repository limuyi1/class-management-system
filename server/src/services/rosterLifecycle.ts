import { randomUUID } from 'node:crypto'

import { getEnrollment, getWorkspace } from '../repositories/workspaces.js'
import { mutate } from './mutations.js'
import { validateTitle } from './workspaces.js'
import { BusinessError } from './errors.js'
import type { AccessContextType, DatabaseType } from '../types/Account.js'
import type { WorkspaceRecordType } from '../../../packages/shared/src/Workspace.js'

/** 进入新学期保留长期班级身份和当期班名，只沿用未转出名单，不复制成绩/评语。 */
export function promoteWorkspace(
  database: DatabaseType,
  context: AccessContextType,
  sourceId: string,
  input: {
    className: string
    termName: string
    inheritStudents: boolean
    inheritAssessments?: boolean
    version: number
  },
  key: string,
  requestId: string
): WorkspaceRecordType {
  const className = validateTitle(input.className, '班名')
  const termName = validateTitle(input.termName, '学期名')
  return mutate(database, context, 'WORKSPACE_PROMOTE', sourceId, input, key, requestId, () => {
    const source = getWorkspace(database, context.ownerId, sourceId)
    if (source.version !== input.version)
      throw new BusinessError(409, 'VERSION_CONFLICT', '来源学期已变化，请刷新')
    if (
      database
        .prepare(
          'SELECT id FROM workspaces WHERE ownerId=? AND ((classId=? AND termName=?) OR (className=? AND termName=?))'
        )
        .get(context.ownerId, source.classId, termName, className, termName)
    )
      throw new BusinessError(409, 'DUPLICATE_WORKSPACE', '目标班级或学期已存在')
    const count = database
      .prepare('SELECT count(*) AS count FROM workspaces WHERE ownerId=?')
      .get(context.ownerId) as { count: number }
    if (count.count >= 1000) throw new BusinessError(400, 'WORKSPACE_LIMIT', '班级学期数量已达上限')
    const id = randomUUID()
    const now = Date.now()
    database
      .prepare(
        'INSERT INTO workspaces(id,ownerId,classId,className,termName,scoreFullMark,createdAt,updatedAt) VALUES(?,?,?,?,?,?,?,?)'
      )
      .run(id, context.ownerId, source.classId, className, termName, source.scoreFullMark, now, now)
    if (input.inheritStudents)
      database
        .prepare(
          `INSERT INTO enrollments(workspaceId,ownerId,studentId,name,disabled,sortIndex)
      SELECT ?,ownerId,studentId,name,disabled,sortIndex FROM enrollments WHERE ownerId=? AND workspaceId=? AND departed=0 AND deletedAt IS NULL`
        )
        .run(id, context.ownerId, sourceId)
    if (input.inheritAssessments) {
      const columns = database
        .prepare(
          'SELECT prop,label,sortIndex,disabled,fullMark FROM assessments WHERE ownerId=? AND workspaceId=? AND deletedAt IS NULL ORDER BY sortIndex,id'
        )
        .all(context.ownerId, sourceId) as Array<{
        prop: string
        label: string
        sortIndex: number
        disabled: number
        fullMark: number | null
      }>
      for (const column of columns)
        database
          .prepare(
            'INSERT INTO assessments(id,workspaceId,ownerId,prop,label,sortIndex,disabled,fullMark) VALUES(?,?,?,?,?,?,?,?)'
          )
          .run(
            randomUUID(),
            id,
            context.ownerId,
            column.prop,
            column.label,
            column.sortIndex,
            column.disabled,
            column.fullMark
          )
    }
    return getWorkspace(database, context.ownerId, id)
  })
}

/** 转班同事务更新源状态和目标空名单，任意冲突回滚，学期名称须相同。 */
export function transferStudent(
  database: DatabaseType,
  context: AccessContextType,
  sourceId: string,
  input: { studentId: string; targetId: string; version: number },
  key: string,
  requestId: string
): { success: true } {
  return mutate(database, context, 'STUDENT_TRANSFER', sourceId, input, key, requestId, () => {
    const source = getWorkspace(database, context.ownerId, sourceId)
    const target = getWorkspace(database, context.ownerId, input.targetId)
    if (source.classId === target.classId || source.termName !== target.termName)
      throw new BusinessError(400, 'INVALID_TRANSFER', '请选择同名学期的其他班级')
    const student = getEnrollment(database, context.ownerId, sourceId, input.studentId)
    if (student.version !== input.version)
      throw new BusinessError(409, 'VERSION_CONFLICT', '学生状态已变化，请刷新')
    if (student.departed) throw new BusinessError(400, 'STUDENT_DEPARTED', '学生已转出')
    if (
      database
        .prepare(
          'SELECT studentId FROM enrollments WHERE workspaceId=? AND ownerId=? AND studentId=?'
        )
        .get(target.id, context.ownerId, input.studentId)
    )
      throw new BusinessError(409, 'STUDENT_EXISTS', '目标班级已有该学生')
    const count = database
      .prepare('SELECT count(*) AS count FROM enrollments WHERE workspaceId=? AND ownerId=?')
      .get(target.id, context.ownerId) as { count: number }
    if (count.count >= 2000) throw new BusinessError(400, 'STUDENT_LIMIT', '目标名单已达上限')
    const order = database
      .prepare(
        'SELECT COALESCE(MAX(sortIndex),0)+1 AS next FROM enrollments WHERE workspaceId=? AND ownerId=?'
      )
      .get(target.id, context.ownerId) as { next: number }
    database
      .prepare(
        'INSERT INTO enrollments(workspaceId,ownerId,studentId,name,disabled,sortIndex) VALUES(?,?,?,?,?,?)'
      )
      .run(
        target.id,
        context.ownerId,
        student.studentId,
        student.name,
        Number(student.disabled),
        order.next
      )
    database
      .prepare(
        'UPDATE enrollments SET departed=1,departedAt=?,version=version+1 WHERE workspaceId=? AND ownerId=? AND studentId=?'
      )
      .run(Date.now(), sourceId, context.ownerId, student.studentId)
    database
      .prepare(
        'UPDATE workspaces SET version=version+1,updatedAt=? WHERE ownerId=? AND id IN (?,?)'
      )
      .run(Date.now(), context.ownerId, sourceId, target.id)
    return { success: true }
  })
}
