import { beginManaged, endManaged } from '../auth/managed.js'
import { listResources } from '../services/resources.js'
import { mutationKey } from './helpers.js'
import { saveAppearance } from '../services/appearance.js'
import { profile } from '../services/accounts.js'
import { actorFor, objectSchema } from './helpers.js'
import { BusinessError } from '../services/errors.js'
import type { DatabaseType } from '../types/Account.js'
import type { FastifyInstance, FastifyRequest } from 'fastify'

/** 代管控制接口使用真实登录身份，目标资料接口使用有效身份。 */
export function registerManaged(app: FastifyInstance, database: DatabaseType): void {
  const realActor = (request: FastifyRequest) => {
    if (request.headers['x-managed-session'])
      throw new BusinessError(400, 'INVALID_CONTEXT', '切换控制接口须使用真实身份')
    return actorFor(database, request)
  }
  app.post<{ Body: { ownerId: string } }>(
    '/me/managed-session',
    {
      schema: { body: objectSchema({ ownerId: { type: 'string', format: 'uuid' } }, ['ownerId']) }
    },
    async (request, reply) => {
      reply.header('Cache-Control', 'no-store')
      return beginManaged(database, realActor(request), request.body.ownerId, request.id)
    }
  )
  app.delete('/me/managed-session', async (request) => {
    endManaged(database, realActor(request), request.id)
    return { success: true }
  })
  const appearanceContext = (request: FastifyRequest) => {
    const user = actorFor(database, request)
    return {
      actor: user.realActor || user,
      ownerId: user.id,
      sessionId: user.sessionId,
      ...('managedSessionId' in user ? { managedSessionId: user.managedSessionId } : {})
    }
  }
  app.get('/me/appearance', async (request) => {
    const value = listResources(
      database,
      appearanceContext(request),
      'settings',
      null,
      request.id
    )[0]
    return {
      theme: value?.content.theme || 'bluepink',
      fontFamily: value?.content.fontFamily || 'system-ui',
      fontSize: value?.content.fontSize || 14
    }
  })
  app.patch<{ Body: { theme: string } }>(
    '/me/appearance',
    {
      schema: {
        body: objectSchema(
          { theme: { type: 'string', enum: ['green', 'orange', 'purple', 'bluepink'] } },
          ['theme']
        )
      }
    },
    async (request) => {
      const ctx = appearanceContext(request)
      return saveAppearance(database, ctx, request.body.theme, mutationKey(request), request.id)
    }
  )
  app.get('/me/context', async (request, reply) => {
    reply.header('Cache-Control', 'no-store')
    return profile(actorFor(database, request, true))
  })
}
