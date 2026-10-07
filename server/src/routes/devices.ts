import { transaction } from '../db/migrate.js'
import { audit } from '../services/accounts.js'
import { BusinessError } from '../services/errors.js'
import { actorFor, idParams } from './helpers.js'
import type { DatabaseType } from '../types/Account.js'
import type { FastifyInstance } from 'fastify'

/** 设备摘要与撤销跟随有效用户；管理员真实登录设备不会混入目标列表。 */
export function registerDevices(app: FastifyInstance, database: DatabaseType): void {
  app.get('/me/devices', async (request) => {
    const actor = actorFor(database, request)
    const records = database
      .prepare(
        `SELECT id,client,createdAt,expiresAt FROM auth_sessions
      WHERE userId=? AND revoked=0 AND expiresAt>? ORDER BY createdAt DESC LIMIT 100`
      )
      .all(actor.id, Date.now()) as Array<{
      id: string
      client: string
      createdAt: number
      expiresAt: number
    }>
    return records.map((record) => ({ ...record, current: record.id === actor.sessionId }))
  })
  app.delete<{ Params: { id: string } }>(
    '/me/devices/:id',
    {
      schema: { params: idParams }
    },
    async (request) => {
      const actor = actorFor(database, request)
      transaction(database, () => {
        const result = database
          .prepare('UPDATE auth_sessions SET revoked=1 WHERE id=? AND userId=? AND revoked=0')
          .run(request.params.id, actor.id)
        if (!result.changes) throw new BusinessError(404, 'NOT_FOUND', '设备登录不存在')
        audit(
          database,
          (actor.realActor || actor).id,
          actor.id,
          'DEVICE_REVOKE',
          request.params.id,
          request.id
        )
      })
      return { success: true, current: request.params.id === actor.sessionId }
    }
  )
  app.post('/me/devices/revoke-all', async (request) => {
    const actor = actorFor(database, request)
    transaction(database, () => {
      database.prepare('UPDATE users SET authVersion=authVersion+1 WHERE id=?').run(actor.id)
      database.prepare('UPDATE auth_sessions SET revoked=1 WHERE userId=?').run(actor.id)
      audit(
        database,
        (actor.realActor || actor).id,
        actor.id,
        'ALL_DEVICES_REVOKE',
        actor.id,
        request.id
      )
    })
    return { success: true }
  })
}
