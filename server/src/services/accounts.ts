import { managedUser } from '../auth/managed.js'
import { randomBytes, randomUUID } from 'node:crypto'

import { hashPassword, verifyPassword } from '../auth/password.js'
import { transaction } from '../db/migrate.js'
import { requireAdmin } from '../policies/access.js'
import { BusinessError } from './errors.js'
import type { AccountRecordType, DatabaseType } from '../types/Account.js'

/** 输出白名单，任何账号接口都不得把数据库内部凭据直接返回。 */
export function profile(user: AccountRecordType) {
  return {
    id: user.id,
    phone: user.phone,
    nickname: user.nickname,
    role: user.role,
    status: user.status,
    superVip: Boolean(user.superVip),
    mustChangePassword: Boolean(user.mustChangePassword),
    version: user.version
  }
}

/** 初期按大陆手机号校验，业务关系始终使用 UUID 而非手机号。 */
export function validatePhone(phone: string): string {
  const value = phone.trim()
  if (!/^1[3-9]\d{9}$/.test(value))
    throw new BusinessError(400, 'INVALID_PHONE', '请输入有效的手机号')
  return value
}

/** 昵称纯文本存储，禁止空白和超长，不要求唯一。 */
export function validateNickname(nickname: string): string {
  const value = nickname.trim()
  if (value.length < 2 || value.length > 30)
    throw new BusinessError(400, 'INVALID_NICKNAME', '昵称需为 2–30 个字符')
  return value
}

/** 与业务写操作同事务保存审计；不记录密码和整份学生数据。 */
export function audit(
  database: DatabaseType,
  actor: string,
  owner: string,
  action: string,
  resource: string,
  requestId: string
): void {
  database
    .prepare('INSERT INTO audit_logs VALUES(?,?,?,?,?,?,?)')
    .run(randomUUID(), actor, owner, action, resource, requestId, Date.now())
}

/** 密码派生等异步工作之后再次检查真实操作者，撤销不能被旧身份快照绕过。 */
function assertCurrentActor(database: DatabaseType, actor: AccountRecordType): void {
  if (actor.realActor && actor.managedSessionId) {
    const real = database
      .prepare('SELECT * FROM users WHERE id=?')
      .get(actor.realActor.id) as AccountRecordType
    const session = database
      .prepare('SELECT sessionId FROM managed_sessions WHERE id=?')
      .get(actor.managedSessionId) as { sessionId: string }
    if (
      !real ||
      real.status !== 'ACTIVE' ||
      real.authVersion !== actor.realActor.authVersion ||
      !session
    )
      throw new BusinessError(403, 'MANAGED_SESSION_INVALID', '代管已失效')
    const auth = database
      .prepare(
        'SELECT id FROM auth_sessions WHERE id=? AND revoked=0 AND expiresAt>? AND authVersion=?'
      )
      .get(session.sessionId, Date.now(), real.authVersion)
    if (!auth) throw new BusinessError(403, 'MANAGED_SESSION_INVALID', '代管已失效')
    managedUser(database, actor.managedSessionId, real, session.sessionId)
  }
  const current = database.prepare('SELECT * FROM users WHERE id=?').get(actor.id) as
    | AccountRecordType
    | undefined
  if (
    !current ||
    current.status !== 'ACTIVE' ||
    current.authVersion !== actor.authVersion ||
    current.role !== actor.role
  ) {
    throw new BusinessError(401, 'UNAUTHENTICATED', '登录已失效，请重新登录')
  }
}

/** 管理员创建普通账号，初始密码只在创建响应中展示一次。 */
export async function createAccount(
  database: DatabaseType,
  actor: AccountRecordType,
  phone: string,
  nickname: string | undefined,
  requestId: string
) {
  requireAdmin(actor)
  const normalized = validatePhone(phone)
  const name = nickname ? validateNickname(nickname) : `老师_${randomBytes(3).toString('hex')}`
  const initialPassword = randomBytes(18).toString('base64url')
  const hash = await hashPassword(initialPassword)
  const id = randomUUID()
  transaction(database, () => {
    assertCurrentActor(database, actor)
    if (database.prepare('SELECT id FROM users WHERE phone=?').get(normalized)) {
      throw new BusinessError(409, 'PHONE_EXISTS', '手机号已被使用')
    }
    database
      .prepare(
        `INSERT INTO users(id,phone,nickname,passwordHash,role,status,createdAt)
      VALUES(?,?,?,?,'USER','ACTIVE',?)`
      )
      .run(id, normalized, name, hash, Date.now())
    audit(database, actor.id, id, 'ACCOUNT_CREATE', id, requestId)
  })
  return {
    user: profile(database.prepare('SELECT * FROM users WHERE id=?').get(id) as AccountRecordType),
    initialPassword
  }
}

/** 管理对象限普通账号；软删除手机号仍占用，不级联删除教学数据。 */
function editableAccount(database: DatabaseType, id: string): AccountRecordType {
  const user = database.prepare('SELECT * FROM users WHERE id=?').get(id) as
    | AccountRecordType
    | undefined
  if (!user || user.status === 'DELETED') throw new BusinessError(404, 'NOT_FOUND', '账号不存在')
  if (user.role === 'ADMIN') throw new BusinessError(403, 'ADMIN_PROTECTED', '管理员账号受保护')
  return user
}

/** 撤销全部设备并更新账号状态，已签发 Access Token 也不能继续使用。 */
export function changeStatus(
  database: DatabaseType,
  actor: AccountRecordType,
  id: string,
  status: 'ACTIVE' | 'DISABLED' | 'DELETED',
  requestId: string
): void {
  requireAdmin(actor)
  transaction(database, () => {
    assertCurrentActor(database, actor)
    editableAccount(database, id)
    database
      .prepare('UPDATE users SET status=?, authVersion=authVersion+1, version=version+1 WHERE id=?')
      .run(status, id)
    database.prepare('UPDATE auth_sessions SET revoked=1 WHERE userId=?').run(id)
    audit(database, actor.id, id, `ACCOUNT_${status}`, id, requestId)
  })
}

/** 修改昵称/手机号需要记录版本；手机号变更同时使旧登录失效。 */
export function editAccount(
  database: DatabaseType,
  actor: AccountRecordType,
  id: string,
  input: { phone: string; nickname: string; version: number },
  requestId: string
): void {
  requireAdmin(actor)
  const phone = validatePhone(input.phone)
  const nickname = validateNickname(input.nickname)
  transaction(database, () => {
    assertCurrentActor(database, actor)
    const user = editableAccount(database, id)
    if (user.version !== input.version)
      throw new BusinessError(409, 'VERSION_CONFLICT', '账号已变化，请刷新')
    const duplicate = database
      .prepare('SELECT id FROM users WHERE phone=? AND id!=?')
      .get(phone, id)
    if (duplicate) throw new BusinessError(409, 'PHONE_EXISTS', '手机号已被使用')
    database
      .prepare(
        'UPDATE users SET phone=?, nickname=?, version=version+1, authVersion=authVersion+? WHERE id=?'
      )
      .run(phone, nickname, Number(phone !== user.phone), id)
    if (phone !== user.phone)
      database.prepare('UPDATE auth_sessions SET revoked=1 WHERE userId=?').run(id)
    audit(database, actor.id, id, 'ACCOUNT_EDIT', id, requestId)
  })
}

/** 本人改密或管理员重置，哈希计算后重新检查账号版本，避免异步期间竞争。 */
export async function replacePassword(
  database: DatabaseType,
  actor: AccountRecordType,
  id: string,
  oldPassword: string,
  nextPassword: string,
  reset: boolean,
  requestId: string
): Promise<void> {
  if (reset) requireAdmin(actor)
  const user = reset ? editableAccount(database, id) : actor
  if (id !== actor.id && !reset) throw new BusinessError(403, 'FORBIDDEN', '无权修改密码')
  if (!(await verifyPassword(oldPassword, actor.passwordHash))) {
    throw new BusinessError(400, 'PASSWORD_MISMATCH', '当前密码错误')
  }
  const hash = await hashPassword(nextPassword)
  transaction(database, () => {
    assertCurrentActor(database, actor)
    const result = database
      .prepare(
        `UPDATE users SET passwordHash=?, mustChangePassword=?,
      authVersion=authVersion+1, version=version+1 WHERE id=? AND version=? AND status!='DELETED'`
      )
      .run(hash, Number(reset), id, user.version)
    if (!result.changes) throw new BusinessError(409, 'VERSION_CONFLICT', '账号已变化，请重新操作')
    database.prepare('UPDATE auth_sessions SET revoked=1 WHERE userId=?').run(id)
    audit(
      database,
      (actor.realActor || actor).id,
      id,
      reset ? 'PASSWORD_RESET' : 'PASSWORD_CHANGE',
      id,
      requestId
    )
  })
}
