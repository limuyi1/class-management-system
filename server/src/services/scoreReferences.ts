import { getWorkspace } from '../repositories/workspaces.js'
import { getAssessment, touchScoreWorkspace } from '../repositories/scores.js'
import { mutate } from './mutations.js'
import { BusinessError } from './errors.js'
import type { AccessContextType, DatabaseType } from '../types/Account.js'
import type { ReferenceInputType } from '../../../packages/shared/src/Scores.js'

/** 一次提交整份参照关系；只能选本人同一长期班级的其他学期。 */
export function setReferences(
  database: DatabaseType,
  context: AccessContextType,
  workspaceId: string,
  input: { version: number; items: ReferenceInputType[] },
  key: string,
  requestId: string
): { success: true } {
  if (input.items.length > 100)
    throw new BusinessError(400, 'REFERENCE_LIMIT', '最多 100 个历史参照')
  return mutate(database, context, 'REFERENCES_SET', workspaceId, input, key, requestId, () => {
    const target = getWorkspace(database, context.ownerId, workspaceId)
    if (target.version !== input.version)
      throw new BusinessError(409, 'VERSION_CONFLICT', '工作区已变化，请刷新后重新选择参照', {
        currentVersion: target.version
      })
    const seen = new Set<string>()
    for (const item of input.items) {
      const source = getWorkspace(database, context.ownerId, item.sourceWorkspaceId)
      if (source.id === target.id || source.classId !== target.classId)
        throw new BusinessError(400, 'INVALID_REFERENCE', '只允许参照本班其他学期')
      getAssessment(database, context.ownerId, source.id, item.assessmentId)
      if (seen.has(item.assessmentId))
        throw new BusinessError(400, 'DUPLICATE_REFERENCE', '参照测评不能重复')
      seen.add(item.assessmentId)
    }
    database
      .prepare('DELETE FROM workspace_references WHERE ownerId=? AND workspaceId=?')
      .run(context.ownerId, workspaceId)
    input.items.forEach((item, index) => {
      database
        .prepare('INSERT INTO workspace_references VALUES(?,?,?,?,?)')
        .run(workspaceId, context.ownerId, item.sourceWorkspaceId, item.assessmentId, index)
    })
    touchScoreWorkspace(database, context.ownerId, workspaceId)
    return { success: true }
  })
}
