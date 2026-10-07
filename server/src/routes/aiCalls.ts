import { cancelAICall } from '../services/ai/cancellation.js'
import { previewAIScores } from '../services/ai/scoreReview.js'
import { registerAISettings } from './aiSettings.js'
import { contextFor, actorFor, objectSchema, idParams, mutationKey } from './helpers.js'
import { readAICall, runAICall } from '../services/ai/calls.js'
import { validateAIAdmin } from '../services/ai/settings.js'
import { reconcileAITokens } from '../services/ai/quota.js'
import { BusinessError } from '../services/errors.js'
import { audit } from '../services/accounts.js'
import { mutate } from '../services/mutations.js'
import type { AICallInputType } from '../services/ai/calls.js'
import type { DatabaseType } from '../types/Account.js'
import type { FastifyInstance } from 'fastify'

/** 完整代管使用目标用户的 AI 配置与额度，审计保留真实操作者；旧业务范围仍使用操作者配置。 */
export function registerAICalls(
  app: FastifyInstance,
  database: DatabaseType,
  directory: string
): void {
  registerAISettings(app, database)
  const uuid = { type: 'string', format: 'uuid' },
    version = { type: 'integer', minimum: 1 }
  app.post<{ Body: AICallInputType }>(
    '/ai/calls',
    {
      schema: {
        body: objectSchema(
          {
            scene: {
              type: 'string',
              enum: ['comment', 'polish', 'tags', 'analysis', 'recognize', 'test', 'page']
            },
            prompt: { type: 'string', maxLength: 60000 },
            workspaceId: uuid,
            workspaceVersion: version,
            studentId: uuid,
            attachmentId: uuid,
            attachmentVersion: version
          },
          ['scene', 'prompt']
        )
      }
    },
    async (request) =>
      runAICall(
        database,
        contextFor(database, request),
        request.body,
        mutationKey(request),
        request.id,
        directory
      )
  )
  app.get<{ Params: { id: string } }>(
    '/ai/calls/:id',
    { schema: { params: idParams } },
    async (request) => readAICall(database, contextFor(database, request), request.params.id)
  )
  app.post<{
    Params: { id: string }
    Body: { items: { studentId: string; assessmentId: string; value: number | null }[] }
  }>(
    '/ai/calls/:id/score-preview',
    {
      schema: {
        params: idParams,
        body: objectSchema(
          {
            items: {
              type: 'array',
              minItems: 1,
              maxItems: 2000,
              items: objectSchema(
                {
                  studentId: uuid,
                  assessmentId: uuid,
                  value: { anyOf: [{ type: 'number', minimum: 0 }, { type: 'null' }] }
                },
                ['studentId', 'assessmentId', 'value']
              )
            }
          },
          ['items']
        )
      }
    },
    async (req) =>
      previewAIScores(database, contextFor(database, req), req.params.id, req.body.items)
  )
  app.post<{ Body: { key: string } }>(
    '/ai/calls/cancel',
    {
      schema: {
        body: objectSchema({ key: { type: 'string', minLength: 8, maxLength: 128 } }, ['key'])
      }
    },
    async (req) => cancelAICall(database, contextFor(database, req), req.body.key)
  )
  app.get('/admin/ai/calls', async (request) => {
    const actor = actorFor(database, request),
      context = { actor, ownerId: actor.id, sessionId: actor.sessionId }
    validateAIAdmin(database, context)
    database
      .prepare("UPDATE ai_calls SET status='UNCERTAIN' WHERE status='RUNNING' AND createdAt<?")
      .run(Date.now() - 300000)
    return {
      items: database
        .prepare(
          'SELECT id,actorId,ownerId,mode,status,inputTokens,outputTokens,createdAt FROM ai_calls ORDER BY createdAt DESC LIMIT 100'
        )
        .all()
    }
  })
  app.post<{ Params: { id: string }; Body: { actual: number; reason: string } }>(
    '/admin/ai/calls/:id/reconcile',
    {
      schema: {
        params: idParams,
        body: objectSchema(
          {
            actual: { type: 'integer', minimum: 0, maximum: 1000000000 },
            reason: { type: 'string', minLength: 1, maxLength: 200 }
          },
          ['actual', 'reason']
        )
      }
    },
    async (request) => {
      const actor = actorFor(database, request),
        context = { actor, ownerId: actor.id, sessionId: actor.sessionId }
      validateAIAdmin(database, context)
      return mutate(
        database,
        context,
        'AI_RECONCILE',
        request.params.id,
        request.body,
        mutationKey(request),
        request.id,
        () => {
          const row = database
            .prepare('SELECT status,mode,createdAt,resultJson FROM ai_calls WHERE id=?')
            .get(request.params.id) as
            | { status: string; mode: string; createdAt: number; resultJson: string | null }
            | undefined
          if (!row || row.status !== 'UNCERTAIN')
            throw new BusinessError(409, 'AI_NOT_UNCERTAIN', '仅能核对未确认调用')
          if (row.mode === 'PLATFORM')
            reconcileAITokens(
              database,
              context,
              request.params.id,
              request.body.actual,
              request.body.reason,
              true
            )
          database
            .prepare('UPDATE ai_calls SET status=? WHERE id=?')
            .run(row.resultJson ? 'DONE' : 'FAILED', request.params.id)
          audit(
            database,
            actor.id,
            actor.id,
            'AI_RECONCILE_REASON',
            `${request.params.id}: ${request.body.reason.trim()}`,
            request.id
          )
          return { success: true }
        }
      )
    }
  )
}
