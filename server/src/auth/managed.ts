import { randomBytes } from 'node:crypto'
import { tokenHash } from './tokens.js'
import { transaction } from '../db/migrate.js'
import { audit, profile } from '../services/accounts.js'
import { BusinessError } from '../services/errors.js'
import type { AccountRecordType, DatabaseType } from '../types/Account.js'

/** 代管令牌仅存哈希，绑定管理员登录设备、目标账号及改密版本。 */
export function managedUser(
  database: DatabaseType,
  id: string,
  actor: AccountRecordType,
  sessionId: string
): AccountRecordType {
  const row = database
    .prepare(
      'SELECT * FROM managed_sessions WHERE id=? AND actorId=? AND sessionId=? AND revoked=0 AND expiresAt>?'
    )
    .get(id, actor.id, sessionId, Date.now()) as
    | { ownerId: string; ownerAuthVersion: number }
    | undefined
  const owner = row
    ? (database.prepare('SELECT * FROM users WHERE id=?').get(row.ownerId) as
        | AccountRecordType
        | undefined)
    : undefined
  if (
    actor.role !== 'ADMIN' ||
    !actor.superVip ||
    actor.mustChangePassword ||
    !row ||
    !owner ||
    owner.status !== 'ACTIVE' ||
    owner.role !== 'USER' ||
    owner.authVersion !== row.ownerAuthVersion
  )
    throw new BusinessError(403, 'MANAGED_SESSION_INVALID', '代管已失效，请返回管理员')
  return owner
}

/** 创建新上下文成功后才结束旧会话，目标无效时保留原上下文。 */
export function beginManaged(
  database: DatabaseType,
  actor: AccountRecordType & { sessionId: string },
  ownerId: string,
  requestId: string
) {
  if (actor.role !== 'ADMIN' || !actor.superVip || actor.mustChangePassword)
    throw new BusinessError(403, 'FORBIDDEN', '请先开启管理员账号代管')
  const owner = database.prepare('SELECT * FROM users WHERE id=?').get(ownerId) as
    | AccountRecordType
    | undefined
  if (!owner || owner.role !== 'USER' || owner.status !== 'ACTIVE')
    throw new BusinessError(400, 'INVALID_TARGET', '请选择有效的老师账号')
  const token = randomBytes(32).toString('base64url')
  const session = database
    .prepare('SELECT expiresAt FROM auth_sessions WHERE id=?')
    .get(actor.sessionId) as { expiresAt: number }
  transaction(database, () => {
    database.prepare('UPDATE managed_sessions SET revoked=1 WHERE sessionId=?').run(actor.sessionId)
    database
      .prepare('INSERT INTO managed_sessions VALUES(?,?,?,?,?,?,0,?)')
      .run(
        tokenHash(token),
        actor.sessionId,
        actor.id,
        owner.id,
        owner.authVersion,
        session.expiresAt,
        Date.now()
      )
    audit(database, actor.id, owner.id, 'MANAGED_START', owner.id, requestId)
  })
  return { token, user: profile(owner) }
}

/** 返回管理员只撤销代管会话，保留真实登录和老师原有设备。 */
export function endManaged(
  database: DatabaseType,
  actor: AccountRecordType & { sessionId: string },
  requestId: string
): void {
  transaction(database, () => {
    database.prepare('UPDATE managed_sessions SET revoked=1 WHERE sessionId=?').run(actor.sessionId)
    audit(database, actor.id, actor.id, 'MANAGED_END', actor.id, requestId)
  })
}
