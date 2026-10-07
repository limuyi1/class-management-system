import { createHash, randomBytes, randomUUID } from 'node:crypto'

import { transaction } from '../db/migrate.js'
import { BusinessError } from '../services/errors.js'
import type { AccountRecordType, DatabaseType } from '../types/Account.js'

export const ACCESS_SECONDS = 3600
export const REFRESH_SECONDS = 7 * 24 * 3600

/** 不透明令牌只存 SHA-256 摘要；它具有足够熵，不需要密码用的慢哈希。 */
export function tokenHash(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

/** 同一设备登录使用固定绝对期限，续期不能无限延长。 */
export function issueTokens(database: DatabaseType, sessionId: string, sessionExpires: number) {
  const accessToken = randomBytes(32).toString('base64url')
  const refreshToken = randomBytes(32).toString('base64url')
  const accessExpires = Math.min(Date.now() + ACCESS_SECONDS * 1000, sessionExpires)
  const insert = database.prepare(
    'INSERT INTO auth_tokens(hash,sessionId,kind,expiresAt) VALUES(?,?,?,?)'
  )
  insert.run(tokenHash(accessToken), sessionId, 'ACCESS', accessExpires)
  insert.run(tokenHash(refreshToken), sessionId, 'REFRESH', sessionExpires)
  return { accessToken, refreshToken, expiresIn: Math.floor((accessExpires - Date.now()) / 1000) }
}

/** 校验当前账号状态和版本，所以禁用/改密不需等待一小时到期。 */
export function authenticate(database: DatabaseType, token: string) {
  const record = database
    .prepare(
      `SELECT u.*, s.id AS sessionId FROM auth_tokens t
    JOIN auth_sessions s ON s.id=t.sessionId JOIN users u ON u.id=s.userId
    WHERE t.hash=? AND t.kind='ACCESS' AND t.expiresAt>? AND s.expiresAt>?
      AND s.revoked=0 AND u.status='ACTIVE' AND s.authVersion=u.authVersion`
    )
    .get(tokenHash(token), Date.now(), Date.now()) as
    | (AccountRecordType & { sessionId: string })
    | undefined
  if (!record) throw new BusinessError(401, 'UNAUTHENTICATED', '登录已失效，请重新登录')
  return record
}

/** 登录提交时再次检查账号版本，防止密码校验期间被禁用或重置后仍签发令牌。 */
export function createSession(database: DatabaseType, user: AccountRecordType) {
  return transaction(database, () => {
    const current = database
      .prepare('SELECT * FROM users WHERE id=?')
      .get(user.id) as AccountRecordType
    if (current.status !== 'ACTIVE' || current.authVersion !== user.authVersion) {
      throw new BusinessError(401, 'LOGIN_FAILED', '手机号或密码错误')
    }
    const id = randomUUID()
    const expires = Date.now() + REFRESH_SECONDS * 1000
    database
      .prepare(
        `INSERT INTO auth_sessions(id,userId,authVersion,expiresAt,createdAt,client)
      VALUES(?,?,?,?,?,'WEB')`
      )
      .run(id, user.id, user.authVersion, expires, Date.now())
    return issueTokens(database, id, expires)
  })
}

/** 原子轮换；重用旧刷新令牌时提交撤销，再向上层报告错误，不能因抛错回滚撤销。 */
export function refreshTokens(database: DatabaseType, refreshToken: string) {
  const result = transaction(database, () => {
    const record = database
      .prepare(
        `SELECT t.*, s.userId, s.revoked, s.expiresAt AS absoluteExpires,
      s.authVersion AS sessionVersion, u.authVersion, u.status FROM auth_tokens t
      JOIN auth_sessions s ON s.id=t.sessionId JOIN users u ON u.id=s.userId
      WHERE t.hash=? AND t.kind='REFRESH'`
      )
      .get(tokenHash(refreshToken)) as
      | {
          sessionId: string
          consumed: number
          expiresAt: number
          absoluteExpires: number
          revoked: number
          sessionVersion: number
          authVersion: number
          status: string
        }
      | undefined
    if (!record) return null
    if (record.consumed) {
      database.prepare('UPDATE auth_sessions SET revoked=1 WHERE id=?').run(record.sessionId)
      return null
    }
    if (
      record.revoked ||
      record.status !== 'ACTIVE' ||
      record.sessionVersion !== record.authVersion ||
      record.expiresAt <= Date.now() ||
      record.absoluteExpires <= Date.now()
    )
      return null
    database.prepare('UPDATE auth_tokens SET consumed=1 WHERE hash=?').run(tokenHash(refreshToken))
    return issueTokens(database, record.sessionId, record.absoluteExpires)
  })
  if (!result) throw new BusinessError(401, 'UNAUTHENTICATED', '登录已失效，请重新登录')
  return result
}
