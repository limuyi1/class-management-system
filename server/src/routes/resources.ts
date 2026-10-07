import { audit } from '../services/accounts.js'
import { contextFor, mutationKey, objectSchema } from './helpers.js'
import { listResources, saveResource, deleteResource } from '../services/resources.js'
import { readAttachmentFile } from '../services/attachmentFiles.js'
import { validateContext } from '../services/mutations.js'
import { BusinessError } from '../services/errors.js'
import type { ResourceType } from '../services/resources.js'
import type { DatabaseType } from '../types/Account.js'
import type { FastifyInstance } from 'fastify'
/** 有界文档接口，客户端不能通过 kind 访问身份或密钥数据。 */
export function registerResources(
  app: FastifyInstance,
  database: DatabaseType,
  directory: string
): void {
  const kind = { type: 'string', enum: ['paper', 'tags', 'settings'] },
    uuid = { type: 'string', format: 'uuid' }
  const params = objectSchema({ kind, id: uuid }, ['kind', 'id'])
  app.get<{ Querystring: { kind: ResourceType['kind']; workspaceId?: string } }>(
    '/resources',
    { schema: { querystring: objectSchema({ kind, workspaceId: uuid }, ['kind']) } },
    async (req) => ({
      items: listResources(
        database,
        contextFor(database, req),
        req.query.kind,
        req.query.workspaceId || null,
        req.id
      )
    })
  )
  app.put<{
    Params: { kind: ResourceType['kind']; id: string }
    Body: {
      workspaceId: string | null
      name: string
      content: Record<string, unknown>
      version: number
    }
  }>(
    '/resources/:kind/:id',
    {
      schema: {
        params,
        body: objectSchema(
          {
            workspaceId: { anyOf: [uuid, { type: 'null' }] },
            name: { type: 'string', minLength: 1, maxLength: 100 },
            content: { type: 'object' },
            version: { type: 'integer', minimum: 0 }
          },
          ['workspaceId', 'name', 'content', 'version']
        )
      }
    },
    async (req) =>
      saveResource(
        database,
        contextFor(database, req),
        { ...req.body, ...req.params },
        mutationKey(req),
        req.id
      )
  )
  app.delete<{ Params: { kind: ResourceType['kind']; id: string }; Body: { version: number } }>(
    '/resources/:kind/:id',
    {
      schema: {
        params,
        body: objectSchema({ version: { type: 'integer', minimum: 1 } }, ['version'])
      }
    },
    async (req) =>
      deleteResource(
        database,
        contextFor(database, req),
        req.params.kind,
        req.params.id,
        req.body.version,
        mutationKey(req),
        req.id
      )
  )
  app.get<{ Params: { id: string; itemId: string } }>(
    '/papers/:id/items/:itemId/content',
    {
      schema: {
        params: objectSchema({ id: uuid, itemId: { type: 'string', maxLength: 100 } }, [
          'id',
          'itemId'
        ])
      }
    },
    async (req, reply) => {
      const ctx = contextFor(database, req)
      validateContext(database, ctx)
      const row = database
        .prepare(
          "SELECT f.hash,f.mimeType FROM paper_files f JOIN business_resources r ON r.id=f.paperId AND r.ownerId=f.ownerId AND r.kind='paper' WHERE f.ownerId=? AND f.paperId=? AND f.itemId=? AND r.deletedAt IS NULL"
        )
        .get(ctx.ownerId, req.params.id, req.params.itemId) as
        | { hash: string; mimeType: string }
        | undefined
      if (!row) throw new BusinessError(404, 'NOT_FOUND', '草稿素材不存在')
      audit(database, ctx.actor.id, ctx.ownerId, 'PAPER_CONTENT_READ', req.params.id, req.id)
      return reply
        .type(row.mimeType)
        .headers({ 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' })
        .send(readAttachmentFile(directory, ctx.ownerId, row.hash))
    }
  )
}
