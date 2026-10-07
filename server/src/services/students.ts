import { randomUUID } from 'node:crypto'

import { getEnrollment, getWorkspace, listEnrollments } from '../repositories/workspaces.js'
import { mutate } from './mutations.js'
import { BusinessError } from './errors.js'
import type { AccessContextType, DatabaseType } from '../types/Account.js'
import type { EditEnrollmentType, EnrollmentType } from '../../../packages/shared/src/Workspace.js'

/** 名单姓名独立于长期学生身份；同名学生允许存在，不能自动合并。 */
function validateName(value: string): string {
  const name = value.trim()
  if (!name || name.length > 60)
    throw new BusinessError(400, 'INVALID_NAME', '姓名需为 1–60 个字符')
  return name
}

/** 名单变化递增工作区版本，为升学期和批量操作提供一致的源版本。 */
function touchWorkspace(database: DatabaseType, ownerId: string, id: string): void {
  database
    .prepare('UPDATE workspaces SET version=version+1,updatedAt=? WHERE id=? AND ownerId=?')
    .run(Date.now(), id, ownerId)
}

/** 增加新学生或从本账号历史身份加入；任何外部 studentId 都要检查归属。 */
export function addStudent(
  database: DatabaseType,
  context: AccessContextType,
  workspaceId: string,
  input: { name: string; studentId?: string },
  key: string,
  requestId: string
): EnrollmentType {
  const name = validateName(input.name)
  return mutate(database, context, 'STUDENT_ADD', workspaceId, input, key, requestId, () => {
    getWorkspace(database, context.ownerId, workspaceId)
    const count = database
      .prepare('SELECT count(*) AS count FROM enrollments WHERE workspaceId=? AND ownerId=?')
      .get(workspaceId, context.ownerId) as { count: number }
    if (count.count >= 2000) throw new BusinessError(400, 'STUDENT_LIMIT', '本期名单数量已达上限')
    const studentId = input.studentId || randomUUID()
    if (input.studentId) {
      if (
        !database
          .prepare('SELECT id FROM students WHERE ownerId=? AND id=?')
          .get(context.ownerId, studentId)
      )
        throw new BusinessError(404, 'NOT_FOUND', '历史学生不存在')
    } else
      database
        .prepare('INSERT INTO students VALUES(?,?,?)')
        .run(context.ownerId, studentId, Date.now())
    if (
      database
        .prepare(
          'SELECT studentId FROM enrollments WHERE workspaceId=? AND ownerId=? AND studentId=?'
        )
        .get(workspaceId, context.ownerId, studentId)
    )
      throw new BusinessError(409, 'STUDENT_EXISTS', '学生已在本期名单中')
    const order = database
      .prepare(
        'SELECT COALESCE(MAX(sortIndex),0)+1 AS next FROM enrollments WHERE workspaceId=? AND ownerId=?'
      )
      .get(workspaceId, context.ownerId) as { next: number }
    database
      .prepare(
        'INSERT INTO enrollments(workspaceId,ownerId,studentId,name,sortIndex) VALUES(?,?,?,?,?)'
      )
      .run(workspaceId, context.ownerId, studentId, name, order.next)
    touchWorkspace(database, context.ownerId, workspaceId)
    return getEnrollment(database, context.ownerId, workspaceId, studentId)
  })
}

/** 版本检查防止另一个设备的姓名/状态修改被静默覆盖；转出不删除历史身份。 */
export function editStudent(
  database: DatabaseType,
  context: AccessContextType,
  workspaceId: string,
  studentId: string,
  input: EditEnrollmentType,
  key: string,
  requestId: string
): EnrollmentType {
  const name = validateName(input.name)
  return mutate(
    database,
    context,
    'STUDENT_EDIT',
    `${workspaceId}/${studentId}`,
    input,
    key,
    requestId,
    () => {
      getWorkspace(database, context.ownerId, workspaceId)
      const current = getEnrollment(database, context.ownerId, workspaceId, studentId)
      const departedAt = input.departed ? (current.departedAt ?? Date.now()) : null
      const result = database
        .prepare(
          'UPDATE enrollments SET name=?,disabled=?,departed=?,departedAt=?,version=version+1 WHERE workspaceId=? AND ownerId=? AND studentId=? AND version=?'
        )
        .run(
          name,
          Number(input.disabled),
          Number(input.departed),
          departedAt,
          workspaceId,
          context.ownerId,
          studentId,
          input.version
        )
      if (!result.changes)
        throw new BusinessError(409, 'VERSION_CONFLICT', '学生资料已变化，请刷新')
      touchWorkspace(database, context.ownerId, workspaceId)
      return getEnrollment(database, context.ownerId, workspaceId, studentId)
    }
  )
}

/** 软删除当前学期名单，长期身份、成绩和其他学期记录保留。 */
export function deleteStudent(
  database: DatabaseType,
  context: AccessContextType,
  workspaceId: string,
  studentId: string,
  version: number,
  key: string,
  requestId: string
): { success: true } {
  return mutate(
    database,
    context,
    'STUDENT_DELETE',
    `${workspaceId}/${studentId}`,
    { version },
    key,
    requestId,
    () => {
      getWorkspace(database, context.ownerId, workspaceId)
      getEnrollment(database, context.ownerId, workspaceId, studentId)
      const result = database
        .prepare(
          'UPDATE enrollments SET deletedAt=?,version=version+1 WHERE workspaceId=? AND ownerId=? AND studentId=? AND version=?'
        )
        .run(Date.now(), workspaceId, context.ownerId, studentId, version)
      if (!result.changes)
        throw new BusinessError(409, 'VERSION_CONFLICT', '学生资料已变化，请刷新')
      touchWorkspace(database, context.ownerId, workspaceId)
      return { success: true }
    }
  )
}

/** 原名单历史身份供显式选择，不根据同名猜测学生身份；数量有上限。 */
export function historicalStudents(database: DatabaseType, ownerId: string): EnrollmentType[] {
  const records = database
    .prepare(
      `SELECT e.* FROM enrollments e JOIN workspaces w ON w.id=e.workspaceId AND w.ownerId=e.ownerId
    WHERE e.ownerId=? AND w.deletedAt IS NULL AND e.deletedAt IS NULL AND e.workspaceId=(SELECT e2.workspaceId FROM enrollments e2
      JOIN workspaces w2 ON w2.id=e2.workspaceId AND w2.ownerId=e2.ownerId
      WHERE w2.deletedAt IS NULL AND e2.deletedAt IS NULL AND e2.ownerId=e.ownerId AND e2.studentId=e.studentId ORDER BY w2.createdAt DESC,w2.id DESC LIMIT 1)
    ORDER BY e.name,e.studentId LIMIT 2000`
    )
    .all(ownerId) as Array<
    Omit<EnrollmentType, 'disabled' | 'departed'> & { disabled: number; departed: number }
  >
  return records.map((row) => ({
    studentId: row.studentId,
    name: row.name,
    disabled: Boolean(row.disabled),
    departed: Boolean(row.departed),
    departedAt: row.departedAt,
    version: row.version
  }))
}

/** 名单读取复用 Repository，后续成绩投影仍按 studentId 连接。 */
export { listEnrollments }
