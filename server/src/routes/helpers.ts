import { managedUser } from '../auth/managed.js'
import { tokenHash } from '../auth/tokens.js'
import { authenticate } from '../auth/tokens.js'
import { rejectManagedIdentity, resolveOwner, requireTeachingOwner } from '../policies/access.js'
import { BusinessError } from '../services/errors.js'
import type { DatabaseType } from '../types/Account.js'
import type { FastifyRequest } from 'fastify'

/** 旧业务范围头不能修改身份；完整代管会话返回有效用户，并保留真实操作者。 */
export function actorFor(
  database: DatabaseType,
  request: FastifyRequest,
  allowPasswordChange = false
) {
  const managed = request.headers['x-managed-account-id']
  rejectManagedIdentity(typeof managed === 'string' ? managed : managed?.[0])
  const bearer = request.headers.authorization
  if (!bearer?.startsWith('Bearer ')) throw new BusinessError(401, 'UNAUTHENTICATED', '请先登录')
  const actor = authenticate(database, bearer.slice(7))
  if (actor.mustChangePassword && !allowPasswordChange) {
    throw new BusinessError(403, 'PASSWORD_CHANGE_REQUIRED', '请先修改初始密码')
  }
  const token = request.headers['x-managed-session']
  if (token !== undefined) {
    if (typeof token !== 'string')
      throw new BusinessError(400, 'INVALID_CONTEXT', '代管会话必须唯一')
    const id = tokenHash(token)
    const owner = managedUser(database, id, actor, actor.sessionId)
    if (owner.mustChangePassword && !allowPasswordChange)
      throw new BusinessError(403, 'PASSWORD_CHANGE_REQUIRED', '请先修改初始密码')
    return { ...owner, sessionId: actor.sessionId, realActor: actor, managedSessionId: id }
  }
  return actor
}

/** 所有写入 DTO 拒绝额外字段，避免未知 role/ownerId 等字段被批量赋值。 */
export function objectSchema(properties: Record<string, unknown>, required: string[]) {
  return { type: 'object', additionalProperties: false, properties, required }
}

export const textSchema = { type: 'string', minLength: 1, maxLength: 128 }
export const idParams = objectSchema({ id: { type: 'string', format: 'uuid' } }, ['id'])

/** 业务访问同时保存真实操作者和明确的 owner；首登未改密不能绕过业务保护。 */
export function contextFor(database: DatabaseType, request: FastifyRequest) {
  const bearer = request.headers.authorization
  if (!bearer?.startsWith('Bearer ')) throw new BusinessError(401, 'UNAUTHENTICATED', '请先登录')
  const actor = authenticate(database, bearer.slice(7))
  if (actor.mustChangePassword)
    throw new BusinessError(403, 'PASSWORD_CHANGE_REQUIRED', '请先修改初始密码')
  const target = request.headers['x-managed-account-id']
  if (Array.isArray(target)) throw new BusinessError(400, 'INVALID_CONTEXT', '账号范围必须唯一')
  const token = request.headers['x-managed-session']
  if (token !== undefined) {
    if (typeof token !== 'string')
      throw new BusinessError(400, 'INVALID_CONTEXT', '代管会话必须唯一')
    const id = tokenHash(token)
    const owner = managedUser(database, id, actor, actor.sessionId)
    if (target && target !== owner.id)
      throw new BusinessError(403, 'FORBIDDEN', '代管期间仅可访问当前用户')
    if (owner.mustChangePassword)
      throw new BusinessError(403, 'PASSWORD_CHANGE_REQUIRED', '请先修改初始密码')
    requireTeachingOwner(database, owner.id)
    return { actor, ownerId: owner.id, sessionId: actor.sessionId, managedSessionId: id }
  }
  const ownerId = resolveOwner(database, actor, target)
  requireTeachingOwner(database, ownerId)
  return { actor, ownerId, sessionId: actor.sessionId }
}

/** 写请求显式携带客户端生成的幂等键，网络重试保持原键和归属。 */
export function mutationKey(request: FastifyRequest): string {
  const key = request.headers['idempotency-key']
  if (typeof key !== 'string') throw new BusinessError(400, 'IDEMPOTENCY_REQUIRED', '请提供幂等键')
  return key
}
