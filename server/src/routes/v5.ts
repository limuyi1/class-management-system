import { previewV5State } from '../services/v5/preview.js'
import { ensureDefaultWorkspace } from '../services/v5/defaultWorkspace.js'
import { contextFor, idParams, mutationKey, objectSchema } from './helpers.js'
import { readV5State } from '../services/v5/state.js'
import { writeV5State } from '../services/v5/write.js'
import type { DatabaseType } from '../types/Account.js'
import type { V5WriteType } from '../../../packages/shared/src/V5.js'
import type { FastifyInstance } from 'fastify'
/** 原页面适配接口仅接受已列明的教学状态，角色和归属统一在服务器校验。 */
export function registerV5(app: FastifyInstance, database: DatabaseType): void {
  app.post('/v5/default-workspace', async (request) =>
    ensureDefaultWorkspace(
      database,
      contextFor(database, request),
      mutationKey(request),
      request.id
    )
  )
  app.get<{ Params: { id: string } }>(
    '/v5/workspaces/:id',
    { schema: { params: idParams } },
    async (request) => readV5State(database, contextFor(database, request), request.params.id)
  )
  for (const preview of [false, true])
    app.route<{ Params: { id: string }; Body: V5WriteType }>({
      method: preview ? 'POST' : 'PUT',
      url: preview ? '/v5/workspaces/:id/preview' : '/v5/workspaces/:id',
      bodyLimit: 4 * 1024 * 1024,
      schema: {
        params: idParams,
        body: objectSchema(
          {
            fingerprint: { type: 'string', pattern: '^[a-f0-9]{64}$' },
            stores: { type: 'object', minProperties: 1 }
          },
          ['fingerprint', 'stores']
        )
      },
      handler: async (request) =>
        (preview ? previewV5State : writeV5State)(
          database,
          contextFor(database, request),
          request.params.id,
          request.body,
          mutationKey(request),
          request.id
        )
    })
}
