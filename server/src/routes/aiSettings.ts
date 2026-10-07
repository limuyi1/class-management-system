import { actorFor, idParams, mutationKey, objectSchema } from './helpers.js'
import {
  configFor,
  readAISettings,
  saveAIConfig,
  saveAIMode,
  validateAIAdmin
} from '../services/ai/settings.js'
import { adjustAIQuota, quotaFor, listAIQuotas } from '../services/ai/quota.js'
import type { AIConfigInputType, AISettingsType } from '../../../packages/shared/src/AI.js'
import type { DatabaseType } from '../types/Account.js'
import type { FastifyInstance, FastifyRequest } from 'fastify'

const version = { type: 'integer', minimum: 0, maximum: 1000000000 }
const configSchema = objectSchema(
  {
    provider: { type: 'string', enum: ['OPENAI', 'GEMINI'] },
    baseUrl: { type: 'string', minLength: 1, maxLength: 500 },
    model: { type: 'string', minLength: 1, maxLength: 120 },
    enabled: { type: 'boolean' },
    version,
    apiKey: { type: ['string', 'null'], minLength: 1, maxLength: 2000 }
  },
  ['provider', 'baseUrl', 'model', 'enabled', 'version']
)

/** AI 设置拒绝旧业务范围头，完整会话跟随有效用户；平台管理仍按有效权限拒绝。 */
export function registerAISettings(app: FastifyInstance, database: DatabaseType): void {
  const context = (request: FastifyRequest) => {
    const actor = actorFor(database, request)
    return {
      actor,
      ownerId: actor.id,
      sessionId: actor.sessionId,
      managedSessionId: actor.managedSessionId
    }
  }
  app.get('/me/ai', async (request, reply) => {
    reply.header('Cache-Control', 'no-store')
    return readAISettings(database, context(request))
  })
  app.put<{ Body: AIConfigInputType }>(
    '/me/ai/config',
    { schema: { body: configSchema } },
    async (request) =>
      saveAIConfig(
        database,
        context(request),
        request.body,
        false,
        mutationKey(request),
        request.id
      )
  )
  app.put<{ Body: { mode: AISettingsType['mode']; version: number } }>(
    '/me/ai/mode',
    {
      schema: {
        body: objectSchema({ mode: { type: 'string', enum: ['PLATFORM', 'PERSONAL'] }, version }, [
          'mode',
          'version'
        ])
      }
    },
    async (request) =>
      saveAIMode(database, context(request), request.body, mutationKey(request), request.id)
  )
  app.get('/admin/ai/config', async (request, reply) => {
    const ctx = context(request)
    validateAIAdmin(database, ctx)
    reply.header('Cache-Control', 'no-store')
    return configFor(database, 'platform')
  })
  app.put<{ Body: AIConfigInputType }>(
    '/admin/ai/config',
    { schema: { body: configSchema } },
    async (request) => {
      const ctx = context(request)
      validateAIAdmin(database, ctx)
      return saveAIConfig(database, ctx, request.body, true, mutationKey(request), request.id)
    }
  )
  app.get<{ Querystring: { page?: number; pageSize?: number; search?: string; status?: string } }>(
    '/admin/ai/quotas',
    {
      schema: {
        querystring: objectSchema(
          {
            page: { type: 'integer', minimum: 1, maximum: 100000 },
            pageSize: { type: 'integer', minimum: 1, maximum: 50 },
            search: { type: 'string', maxLength: 60 },
            status: { type: 'string', enum: ['ACTIVE', 'DISABLED', ''] }
          },
          []
        )
      }
    },
    async (request) => {
      validateAIAdmin(database, context(request))
      return listAIQuotas(database, request.query)
    }
  )
  app.get<{ Params: { id: string } }>(
    '/admin/users/:id/ai-quota',
    { schema: { params: idParams } },
    async (request) => {
      validateAIAdmin(database, context(request))
      return quotaFor(database, request.params.id)
    }
  )
  app.post<{ Params: { id: string }; Body: { delta: number; version: number; reason: string } }>(
    '/admin/users/:id/ai-quota',
    {
      schema: {
        params: idParams,
        body: objectSchema(
          {
            delta: { type: 'integer', minimum: -1000000000, maximum: 1000000000 },
            version,
            reason: { type: 'string', minLength: 1, maxLength: 200 }
          },
          ['delta', 'version', 'reason']
        )
      }
    },
    async (request) => {
      const ctx = context(request)
      validateAIAdmin(database, ctx)
      return adjustAIQuota(
        database,
        ctx,
        request.params.id,
        request.body,
        mutationKey(request),
        request.id
      )
    }
  )
}
