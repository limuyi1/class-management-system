import { randomBytes } from 'node:crypto'

import { verifyPassword } from '../auth/password.js'
import { rateLimit } from '../auth/limits.js'
import { transaction } from '../db/migrate.js'
import { requireAdmin } from '../policies/access.js'
import {
  audit,
  changeStatus,
  createAccount,
  editAccount,
  profile,
  replacePassword,
  validateNickname
} from '../services/accounts.js'
import { BusinessError } from '../services/errors.js'
import { actorFor, idParams, objectSchema, textSchema } from './helpers.js'
import type { AccountRecordType, DatabaseType } from '../types/Account.js'
import type { FastifyInstance } from 'fastify'

/** 所有账号管理路由先校验真实管理员身份，业务代管头不能改变目标身份。 */
export function registerAccounts(app: FastifyInstance, database: DatabaseType): void {
  app.get<{ Querystring: { page?: number; search?: string } }>(
    '/admin/users',
    {
      schema: {
        querystring: objectSchema(
          {
            page: { type: 'integer', minimum: 1, maximum: 100000 },
            search: { type: 'string', maxLength: 30 }
          },
          []
        )
      }
    },
    async (request) => {
      requireAdmin(actorFor(database, request))
      const pattern = `%${request.query.search || ''}%`
      const users = database
        .prepare(
          "SELECT * FROM users WHERE status!='DELETED' AND (phone LIKE ? OR nickname LIKE ?) ORDER BY createdAt DESC LIMIT 50 OFFSET ?"
        )
        .all(pattern, pattern, ((request.query.page || 1) - 1) * 50) as AccountRecordType[]
      const total = database
        .prepare(
          "SELECT count(*) AS count FROM users WHERE status!='DELETED' AND (phone LIKE ? OR nickname LIKE ?)"
        )
        .get(pattern, pattern) as { count: number }
      return { items: users.map(profile), total: total.count }
    }
  )
  app.post<{ Body: { phone: string; nickname?: string } }>(
    '/admin/users',
    {
      schema: { body: objectSchema({ phone: textSchema, nickname: textSchema }, ['phone']) }
    },
    async (request) =>
      createAccount(
        database,
        actorFor(database, request),
        request.body.phone,
        request.body.nickname,
        request.id
      )
  )
  app.patch<{ Params: { id: string }; Body: { phone: string; nickname: string; version: number } }>(
    '/admin/users/:id',
    {
      schema: {
        params: idParams,
        body: objectSchema(
          { phone: textSchema, nickname: textSchema, version: { type: 'integer', minimum: 1 } },
          ['phone', 'nickname', 'version']
        )
      }
    },
    async (request) => {
      editAccount(
        database,
        actorFor(database, request),
        request.params.id,
        request.body,
        request.id
      )
      return { success: true }
    }
  )
  app.patch<{ Params: { id: string }; Body: { status: 'ACTIVE' | 'DISABLED' } }>(
    '/admin/users/:id/status',
    {
      schema: {
        params: idParams,
        body: objectSchema({ status: { type: 'string', enum: ['ACTIVE', 'DISABLED'] } }, ['status'])
      }
    },
    async (request) => {
      changeStatus(
        database,
        actorFor(database, request),
        request.params.id,
        request.body.status,
        request.id
      )
      return { success: true }
    }
  )
  app.delete<{ Params: { id: string } }>(
    '/admin/users/:id',
    { schema: { params: idParams } },
    async (request) => {
      changeStatus(database, actorFor(database, request), request.params.id, 'DELETED', request.id)
      return { success: true }
    }
  )
  app.post<{ Params: { id: string }; Body: { password: string } }>(
    '/admin/users/:id/reset-password',
    {
      schema: { params: idParams, body: objectSchema({ password: textSchema }, ['password']) }
    },
    async (request) => {
      const actor = actorFor(database, request)
      rateLimit(database, `reauth:${actor.id}`, 10, 15 * 60000)
      const initialPassword = randomBytes(18).toString('base64url')
      await replacePassword(
        database,
        actor,
        request.params.id,
        request.body.password,
        initialPassword,
        true,
        request.id
      )
      return { initialPassword }
    }
  )
  app.patch<{ Body: { nickname: string } }>(
    '/me/profile',
    {
      schema: { body: objectSchema({ nickname: textSchema }, ['nickname']) }
    },
    async (request) => {
      const actor = actorFor(database, request)
      const nickname = validateNickname(request.body.nickname)
      database
        .prepare('UPDATE users SET nickname=?,version=version+1 WHERE id=?')
        .run(nickname, actor.id)
      audit(
        database,
        (actor.realActor || actor).id,
        actor.id,
        'PROFILE_CHANGE',
        actor.id,
        request.id
      )
      return profile(
        database.prepare('SELECT * FROM users WHERE id=?').get(actor.id) as AccountRecordType
      )
    }
  )
  app.post<{ Body: { currentPassword: string; newPassword: string } }>(
    '/me/password',
    {
      schema: {
        body: objectSchema({ currentPassword: textSchema, newPassword: textSchema }, [
          'currentPassword',
          'newPassword'
        ])
      }
    },
    async (request) => {
      const actor = actorFor(database, request, true)
      rateLimit(database, `reauth:${actor.id}`, 10, 15 * 60000)
      await replacePassword(
        database,
        actor,
        actor.id,
        request.body.currentPassword,
        request.body.newPassword,
        false,
        request.id
      )
      return { success: true }
    }
  )
  app.patch<{ Body: { enabled: boolean; password: string } }>(
    '/admin/me/super-vip',
    {
      schema: {
        body: objectSchema({ enabled: { type: 'boolean' }, password: textSchema }, [
          'enabled',
          'password'
        ])
      }
    },
    async (request) => {
      const actor = actorFor(database, request)
      requireAdmin(actor)
      rateLimit(database, `reauth:${actor.id}`, 10, 15 * 60000)
      if (!(await verifyPassword(request.body.password, actor.passwordHash)))
        throw new BusinessError(400, 'PASSWORD_MISMATCH', '当前密码错误')
      transaction(database, () => {
        const result = database
          .prepare('UPDATE users SET superVip=?,version=version+1 WHERE id=? AND version=?')
          .run(Number(request.body.enabled), actor.id, actor.version)
        if (!result.changes) throw new BusinessError(409, 'VERSION_CONFLICT', '账号已变化，请重试')
        audit(database, actor.id, actor.id, 'VIP_CHANGE', actor.id, request.id)
      })
      return { success: true }
    }
  )
}
