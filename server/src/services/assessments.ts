import { randomUUID } from 'node:crypto'
import { getWorkspace } from '../repositories/workspaces.js'
import { getAssessment, listAssessments, touchScoreWorkspace } from '../repositories/scores.js'
import { mutate } from './mutations.js'
import { BusinessError } from './errors.js'
import { validateTitle } from './workspaces.js'
import type { AccessContextType, DatabaseType } from '../types/Account.js'
import type { AssessmentInputType, AssessmentType } from '../../../packages/shared/src/Scores.js'

/** 满分为空时动态沿用学期默认值，改满分不篡改已经录入的原始分。 */
function validateInput(input: AssessmentInputType): string {
  const label = validateTitle(input.label, '测评名称')
  if (
    input.fullMark !== null &&
    (!Number.isFinite(input.fullMark) || input.fullMark <= 0 || input.fullMark > 100000)
  )
    throw new BusinessError(400, 'INVALID_FULL_MARK', '测评满分无效')
  if (!Number.isInteger(input.sortIndex) || input.sortIndex < 0 || input.sortIndex > 10000)
    throw new BusinessError(400, 'INVALID_ORDER', '排序需为 0–10000 的整数')
  return label
}
export function createAssessment(
  database: DatabaseType,
  context: AccessContextType,
  workspaceId: string,
  input: AssessmentInputType,
  key: string,
  requestId: string
): AssessmentType {
  const label = validateInput(input)
  const prop = input.prop || `score_${randomUUID().replaceAll('-', '')}`
  if (
    !/^[A-Za-z][A-Za-z0-9_]{0,79}$/.test(prop) ||
    [
      'name',
      'studentId',
      'disabled',
      'departed',
      'departedAt',
      'comment',
      'tags',
      'constructor',
      'prototype'
    ].includes(prop)
  )
    throw new BusinessError(400, 'INVALID_PROP', '成绩字段名无效或属于基础字段')
  return mutate(database, context, 'ASSESSMENT_CREATE', workspaceId, input, key, requestId, () => {
    getWorkspace(database, context.ownerId, workspaceId)
    if (listAssessments(database, context.ownerId, workspaceId).length >= 100)
      throw new BusinessError(400, 'ASSESSMENT_LIMIT', '本期最多 100 个测评')
    if (
      database
        .prepare('SELECT id FROM assessments WHERE workspaceId=? AND ownerId=? AND prop=?')
        .get(workspaceId, context.ownerId, prop)
    )
      throw new BusinessError(409, 'PROP_EXISTS', '字段名已经使用，删除后也不能复用')
    const id = randomUUID()
    database
      .prepare(
        'INSERT INTO assessments(id,workspaceId,ownerId,prop,label,sortIndex,disabled,fullMark) VALUES(?,?,?,?,?,?,?,?)'
      )
      .run(
        id,
        workspaceId,
        context.ownerId,
        prop,
        label,
        input.sortIndex,
        Number(input.disabled),
        input.fullMark
      )
    touchScoreWorkspace(database, context.ownerId, workspaceId)
    return getAssessment(database, context.ownerId, workspaceId, id)
  })
}
export function editAssessment(
  database: DatabaseType,
  context: AccessContextType,
  workspaceId: string,
  id: string,
  input: AssessmentInputType & { version: number },
  key: string,
  requestId: string
): AssessmentType {
  const label = validateInput(input)
  return mutate(
    database,
    context,
    'ASSESSMENT_EDIT',
    `${workspaceId}/${id}`,
    input,
    key,
    requestId,
    () => {
      getWorkspace(database, context.ownerId, workspaceId)
      const current = getAssessment(database, context.ownerId, workspaceId, id)
      if (current.version !== input.version)
        throw new BusinessError(409, 'VERSION_CONFLICT', '测评配置已变化，请刷新', { current })
      database
        .prepare(
          'UPDATE assessments SET label=?,sortIndex=?,disabled=?,fullMark=?,version=version+1 WHERE id=? AND workspaceId=? AND ownerId=? AND version=?'
        )
        .run(
          label,
          input.sortIndex,
          Number(input.disabled),
          input.fullMark,
          id,
          workspaceId,
          context.ownerId,
          input.version
        )
      touchScoreWorkspace(database, context.ownerId, workspaceId)
      return getAssessment(database, context.ownerId, workspaceId, id)
    }
  )
}
/** 被参照的列先解除引用；删除仅打标记，成绩保留供受控恢复。 */
export function deleteAssessment(
  database: DatabaseType,
  context: AccessContextType,
  workspaceId: string,
  id: string,
  version: number,
  key: string,
  requestId: string
): { success: true } {
  return mutate(
    database,
    context,
    'ASSESSMENT_DELETE',
    `${workspaceId}/${id}`,
    { version },
    key,
    requestId,
    () => {
      getWorkspace(database, context.ownerId, workspaceId)
      const current = getAssessment(database, context.ownerId, workspaceId, id)
      if (current.version !== version)
        throw new BusinessError(409, 'VERSION_CONFLICT', '测评配置已变化，请刷新', { current })
      if (
        database
          .prepare(
            'SELECT assessmentId FROM workspace_references WHERE ownerId=? AND assessmentId=? LIMIT 1'
          )
          .get(context.ownerId, id)
      )
        throw new BusinessError(
          409,
          'ASSESSMENT_REFERENCED',
          '该测评已被其他学期参照，请先解除引用'
        )
      database
        .prepare(
          'UPDATE assessments SET deletedAt=?,version=version+1 WHERE ownerId=? AND workspaceId=? AND id=?'
        )
        .run(Date.now(), context.ownerId, workspaceId, id)
      touchScoreWorkspace(database, context.ownerId, workspaceId)
      return { success: true }
    }
  )
}
