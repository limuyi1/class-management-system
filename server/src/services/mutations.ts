import { createHash } from 'node:crypto'

import { transaction } from '../db/migrate.js'
import { managedUser } from '../auth/managed.js'
import { resolveOwner } from '../policies/access.js'
import { audit } from './accounts.js'
import { BusinessError } from './errors.js'
import type { AccessContextType, AccountRecordType, DatabaseType } from '../types/Account.js'

/** 提交前重新读取 actor 和授权，异步任务不能使用关闭 VIP 前的权限快照。 */
export function validateContext(database: DatabaseType, context: AccessContextType): void {
  const actor = database
    .prepare('SELECT * FROM users WHERE id=?')
    .get((context.actor.realActor || context.actor).id) as AccountRecordType | undefined
  if (
    !actor ||
    actor.status !== 'ACTIVE' ||
    actor.authVersion !== (context.actor.realActor || context.actor).authVersion ||
    actor.mustChangePassword
  ) {
    throw new BusinessError(401, 'UNAUTHENTICATED', '登录已失效，请重新登录')
  }
  if (context.sessionId) {
    const session = database
      .prepare(
        'SELECT id FROM auth_sessions WHERE id=? AND userId=? AND revoked=0 AND expiresAt>? AND authVersion=?'
      )
      .get(context.sessionId, actor.id, Date.now(), actor.authVersion)
    if (!session) throw new BusinessError(401, 'UNAUTHENTICATED', '登录已失效，请重新登录')
  }
  if (context.managedSessionId) {
    const owner = managedUser(database, context.managedSessionId, actor, context.sessionId)
    if (owner.id !== context.ownerId || owner.mustChangePassword)
      throw new BusinessError(403, 'MANAGED_SESSION_INVALID', '代管上下文已变化')
  } else resolveOwner(database, actor, context.ownerId)
}

/** 幂等写入和审计同事务提交；同键不同动作/目标/内容拒绝，不会静默覆盖。 */
export function mutate<T>(
  database: DatabaseType,
  context: AccessContextType,
  action: string,
  resourceId: string,
  payload: unknown,
  key: string,
  requestId: string,
  operation: () => T
): T {
  if (!/^[A-Za-z0-9_-]{8,128}$/.test(key))
    throw new BusinessError(400, 'IDEMPOTENCY_REQUIRED', '请提供有效的幂等键')
  const hash = createHash('sha256')
    .update(JSON.stringify([action, resourceId, payload]))
    .digest('hex')
  return transaction(database, () => {
    validateContext(database, context)
    const receipt = database
      .prepare('SELECT * FROM mutation_receipts WHERE actorId=? AND ownerId=? AND key=?')
      .get((context.actor.realActor || context.actor).id, context.ownerId, key) as
      | {
          requestHash: string
          resultJson: string
        }
      | undefined
    if (receipt) {
      if (receipt.requestHash !== hash)
        throw new BusinessError(409, 'IDEMPOTENCY_CONFLICT', '请求键已用于其他操作')
      return JSON.parse(receipt.resultJson) as T
    }
    const result = operation()
    database
      .prepare('INSERT INTO mutation_receipts VALUES(?,?,?,?,?,?)')
      .run(
        (context.actor.realActor || context.actor).id,
        context.ownerId,
        key,
        hash,
        JSON.stringify(result),
        Date.now()
      )
    audit(
      database,
      (context.actor.realActor || context.actor).id,
      context.ownerId,
      action,
      resourceId,
      requestId
    )
    return result
  })
}
