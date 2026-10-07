import { transaction } from '../db/migrate.js'
import { getWorkspace, listEnrollments } from '../repositories/workspaces.js'
import { touchScoreWorkspace } from '../repositories/scores.js'
import { audit } from './accounts.js'
import { mutate, validateContext } from './mutations.js'
import { BusinessError } from './errors.js'
import { validateClassroomTool } from './classroomToolValidation.js'
import type { AccessContextType, DatabaseType } from '../types/Account.js'
import type {
  ClassroomToolContentType,
  ClassroomToolKindType,
  ClassroomToolRecordType,
  ClassroomToolStateType
} from '../../../packages/shared/src/ClassroomTools.js'

interface ToolRowType {
  id: string
  kind: ClassroomToolKindType
  version: number
  contentJson: string
}
const dto = (row: ToolRowType): ClassroomToolRecordType => ({
  id: row.id,
  kind: row.kind,
  version: row.version,
  content: JSON.parse(row.contentJson) as ClassroomToolContentType
})
function getTool(
  database: DatabaseType,
  ownerId: string,
  workspaceId: string,
  id: string
): ClassroomToolRecordType {
  const row = database
    .prepare(
      'SELECT * FROM classroom_tools WHERE id=? AND ownerId=? AND workspaceId=? AND deletedAt IS NULL'
    )
    .get(id, ownerId, workspaceId) as ToolRowType | undefined
  if (!row) throw new BusinessError(404, 'NOT_FOUND', '方案不存在或已删除')
  return dto(row)
}
/** 列表与名单在同一个事务中读取，代管读取记录真实操作者。 */
export function readClassroomTools(
  database: DatabaseType,
  context: AccessContextType,
  workspaceId: string,
  requestId: string
): ClassroomToolStateType {
  return transaction(database, () => {
    validateContext(database, context)
    const workspace = getWorkspace(database, context.ownerId, workspaceId)
    const rows = database
      .prepare(
        'SELECT * FROM classroom_tools WHERE ownerId=? AND workspaceId=? AND deletedAt IS NULL ORDER BY createdAt,id'
      )
      .all(context.ownerId, workspaceId) as ToolRowType[]
    audit(
      database,
      context.actor.id,
      context.ownerId,
      'CLASSROOM_TOOLS_READ',
      workspaceId,
      requestId
    )
    return {
      workspace,
      students: listEnrollments(database, context.ownerId, workspaceId),
      tools: rows.map(dto)
    }
  })
}
/** 每个方案独立 CAS；客户端 UUID 支持重试，服务端覆盖身份与时间字段。 */
export function saveClassroomTool(
  database: DatabaseType,
  context: AccessContextType,
  workspaceId: string,
  id: string,
  input: {
    expectedVersion: number
    kind: ClassroomToolKindType
    content: ClassroomToolContentType
  },
  key: string,
  requestId: string
): ClassroomToolRecordType {
  return mutate(
    database,
    context,
    'CLASSROOM_TOOL_SAVE',
    `${workspaceId}:${id}`,
    input,
    key,
    requestId,
    () => {
      getWorkspace(database, context.ownerId, workspaceId)
      validateClassroomTool(database, context.ownerId, workspaceId, input.kind, input.content)
      const existing = database
        .prepare('SELECT * FROM classroom_tools WHERE id=? AND ownerId=? AND workspaceId=?')
        .get(id, context.ownerId, workspaceId) as
        | (ToolRowType & { deletedAt: number | null })
        | undefined
      if (existing?.deletedAt)
        throw new BusinessError(409, 'TOOL_DELETED', '方案已删除，不能重新覆盖')
      if ((existing?.version || 0) !== input.expectedVersion)
        throw new BusinessError(409, 'VERSION_CONFLICT', '方案已被其他设备修改，请保留草稿后刷新', {
          current: existing ? dto(existing) : null
        })
      if (existing && existing.kind !== input.kind)
        throw new BusinessError(400, 'INVALID_TOOL', '不能改变方案类型')
      const now = Date.now()
      const content = {
        ...input.content,
        id,
        name: input.content.name.trim(),
        createdAt: existing ? dto(existing).content.createdAt : new Date(now).toISOString(),
        updatedAt: new Date(now).toISOString()
      }
      if (existing)
        database
          .prepare(
            'UPDATE classroom_tools SET contentJson=?,version=version+1,updatedAt=? WHERE id=? AND ownerId=? AND workspaceId=? AND version=?'
          )
          .run(JSON.stringify(content), now, id, context.ownerId, workspaceId, existing.version)
      else {
        if (database.prepare('SELECT id FROM classroom_tools WHERE id=?').get(id))
          throw new BusinessError(409, 'ID_CONFLICT', '方案标识已使用，请重新创建')
        database
          .prepare('INSERT INTO classroom_tools VALUES(?,?,?,?,?,1,?,?,NULL)')
          .run(id, workspaceId, context.ownerId, input.kind, JSON.stringify(content), now, now)
      }
      touchScoreWorkspace(database, context.ownerId, workspaceId)
      return getTool(database, context.ownerId, workspaceId, id)
    }
  )
}
/** 删除只记录时间与版本，保留原方案供运维审计，不级联清除学生。 */
export function deleteClassroomTool(
  database: DatabaseType,
  context: AccessContextType,
  workspaceId: string,
  id: string,
  version: number,
  key: string,
  requestId: string
): { deleted: true } {
  return mutate(
    database,
    context,
    'CLASSROOM_TOOL_DELETE',
    `${workspaceId}:${id}`,
    { version },
    key,
    requestId,
    () => {
      getWorkspace(database, context.ownerId, workspaceId)
      const current = getTool(database, context.ownerId, workspaceId, id)
      if (current.version !== version)
        throw new BusinessError(409, 'VERSION_CONFLICT', '方案已被其他设备修改')
      database
        .prepare(
          'UPDATE classroom_tools SET deletedAt=?,updatedAt=?,version=version+1 WHERE id=? AND ownerId=? AND workspaceId=? AND version=?'
        )
        .run(Date.now(), Date.now(), id, context.ownerId, workspaceId, version)
      touchScoreWorkspace(database, context.ownerId, workspaceId)
      return { deleted: true }
    }
  )
}
