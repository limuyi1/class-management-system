import { randomUUID } from 'node:crypto'

import { getWorkspace } from '../repositories/workspaces.js'
import { mutate, validateContext } from './mutations.js'
import { BusinessError } from './errors.js'
import type { AccessContextType, DatabaseType } from '../types/Account.js'
import type {
  CreateWorkspaceType,
  WorkspaceRecordType
} from '../../../packages/shared/src/Workspace.js'

/** 班名和学期名去首尾空白，保持各学期名称，不修改往期记录。 */
export function validateTitle(value: string, label: string): string {
  const title = value.trim()
  if (!title || title.length > 60)
    throw new BusinessError(400, 'INVALID_TITLE', `${label}需为 1–60 个字符`)
  return title
}

/** 同账号同学期班名唯一，同长期班级学期名唯一。 */
function checkNames(
  database: DatabaseType,
  ownerId: string,
  classId: string,
  className: string,
  termName: string,
  exceptId = ''
): void {
  const duplicate = database
    .prepare(
      `SELECT id FROM workspaces WHERE ownerId=? AND id!=?
    AND ((className=? AND termName=?) OR (classId=? AND termName=?))`
    )
    .get(ownerId, exceptId, className, termName, classId, termName)
  if (duplicate) throw new BusinessError(409, 'DUPLICATE_WORKSPACE', '该班级或学期名称已存在')
}

/** 每次加载都按账号过滤，不把当前选择保存在数据库全局目录。 */
export function listWorkspaces(
  database: DatabaseType,
  context: AccessContextType
): WorkspaceRecordType[] {
  validateContext(database, context)
  return database
    .prepare('SELECT * FROM workspaces WHERE ownerId=? AND deletedAt IS NULL ORDER BY createdAt,id LIMIT 1000')
    .all(context.ownerId) as WorkspaceRecordType[]
}

/** 创建空班级/学期；沿用已有长期班级必须验证同一账号归属。 */
export function createWorkspace(
  database: DatabaseType,
  context: AccessContextType,
  input: CreateWorkspaceType,
  key: string,
  requestId: string
): WorkspaceRecordType {
  const className = validateTitle(input.className, '班名')
  const termName = validateTitle(input.termName, '学期名')
  const fullMark = input.scoreFullMark ?? 100
  if (!Number.isFinite(fullMark) || fullMark <= 0 || fullMark > 100000)
    throw new BusinessError(400, 'INVALID_FULL_MARK', '满分需大于零且不超过 100000')
  return mutate(
    database,
    context,
    'WORKSPACE_CREATE',
    input.classId || 'new',
    input,
    key,
    requestId,
    () => {
      const classId = input.classId || randomUUID()
      if (input.classId) {
        if (
          !database
            .prepare('SELECT id FROM classes WHERE id=? AND ownerId=?')
            .get(classId, context.ownerId)
        )
          throw new BusinessError(404, 'NOT_FOUND', '班级不存在')
      }
      checkNames(database, context.ownerId, classId, className, termName)
      const count = database
        .prepare('SELECT count(*) AS count FROM workspaces WHERE ownerId=?')
        .get(context.ownerId) as { count: number }
      if (count.count >= 1000)
        throw new BusinessError(400, 'WORKSPACE_LIMIT', '班级学期数量已达上限')
      const now = Date.now()
      if (!input.classId)
        database.prepare('INSERT INTO classes VALUES(?,?,?)').run(classId, context.ownerId, now)
      const id = randomUUID()
      database
        .prepare(
          'INSERT INTO workspaces(id,ownerId,classId,className,termName,scoreFullMark,createdAt,updatedAt) VALUES(?,?,?,?,?,?,?,?)'
        )
        .run(id, context.ownerId, classId, className, termName, fullMark, now, now)
      return getWorkspace(database, context.ownerId, id)
    }
  )
}

/** 条件更新，冲突保留服务器数据；本期改名不改写往期班名。 */
export function editWorkspace(
  database: DatabaseType,
  context: AccessContextType,
  id: string,
  input: CreateWorkspaceType & { version: number },
  key: string,
  requestId: string
): WorkspaceRecordType {
  const className = validateTitle(input.className, '班名')
  const termName = validateTitle(input.termName, '学期名')
  return mutate(database, context, 'WORKSPACE_EDIT', id, input, key, requestId, () => {
    const current = getWorkspace(database, context.ownerId, id)
    checkNames(database, context.ownerId, current.classId, className, termName, id)
    const fullMark = input.scoreFullMark ?? current.scoreFullMark
    if (!Number.isFinite(fullMark) || fullMark <= 0 || fullMark > 100000)
      throw new BusinessError(400, 'INVALID_FULL_MARK', '满分无效')
    const result = database
      .prepare(
        'UPDATE workspaces SET className=?,termName=?,scoreFullMark=?,version=version+1,updatedAt=? WHERE id=? AND ownerId=? AND version=?'
      )
      .run(className, termName, fullMark, Date.now(), id, context.ownerId, input.version)
    if (!result.changes) throw new BusinessError(409, 'VERSION_CONFLICT', '班级学期已变化，请刷新')
    return getWorkspace(database, context.ownerId, id)
  })
}
