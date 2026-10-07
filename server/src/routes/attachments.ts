import { moveAttachment, reorderAttachments } from '../services/attachmentOrder.js'
import { dirname, resolve } from 'node:path'
import {
  attachmentMetadata,
  downloadAttachment,
  editAttachment,
  listAttachments,
  uploadAttachment
} from '../services/attachments.js'
import { MAX_ATTACHMENT_BYTES } from '../services/attachmentFiles.js'
import { BusinessError } from '../services/errors.js'
import { contextFor, idParams, mutationKey, objectSchema } from './helpers.js'
import type { FastifyInstance } from 'fastify'
import type { DatabaseType } from '../types/Account.js'

/** 存储目录可在测试注入；生产默认与 SQLite 同一 data 目录，不能通过 URL 公开。 */
export function attachmentDirectory(): string {
  return resolve(
    process.env.ATTACHMENT_DIR ||
      resolve(
        dirname(resolve(process.env.DATABASE_PATH || '../data/class-management.sqlite')),
        'attachments'
      )
  )
}
/** 图片采用独立二进制接口，JSON 业务接口仍保持原有 1 MB 上限。 */
export function registerAttachments(
  app: FastifyInstance,
  database: DatabaseType,
  directory: string
): void {
  app.put<{ Body: { items: { id: string; version: number }[] } }>(
    '/attachments/order',
    {
      schema: {
        body: objectSchema(
          {
            items: {
              type: 'array',
              maxItems: 1000,
              items: objectSchema(
                {
                  id: { type: 'string', format: 'uuid' },
                  version: { type: 'integer', minimum: 1 }
                },
                ['id', 'version']
              )
            }
          },
          ['items']
        )
      }
    },
    async (request) =>
      reorderAttachments(
        database,
        contextFor(database, request),
        request.body.items,
        mutationKey(request),
        request.id
      )
  )
  app.post<{ Params: { id: string }; Body: { version: number; direction: 'up' | 'down' } }>(
    '/attachments/:id/move',
    {
      schema: {
        params: idParams,
        body: objectSchema(
          {
            version: { type: 'integer', minimum: 1 },
            direction: { type: 'string', enum: ['up', 'down'] }
          },
          ['version', 'direction']
        )
      }
    },
    async (request) =>
      moveAttachment(
        database,
        contextFor(database, request),
        request.params.id,
        request.body,
        mutationKey(request),
        request.id
      )
  )
  app.addContentTypeParser(
    ['image/png', 'image/jpeg'],
    { parseAs: 'buffer', bodyLimit: MAX_ATTACHMENT_BYTES },
    (_request, body, done) => done(null, body)
  )
  app.get<{ Querystring: { offset?: number } }>(
    '/attachments',
    {
      schema: {
        querystring: objectSchema({ offset: { type: 'integer', minimum: 0, maximum: 1000000 } }, [])
      }
    },
    async (request) =>
      listAttachments(
        database,
        contextFor(database, request),
        request.query.offset || 0,
        request.id
      )
  )
  app.put<{ Params: { id: string }; Body: Buffer }>(
    '/attachments/:id',
    {
      bodyLimit: MAX_ATTACHMENT_BYTES,
      onRequest: async (request) => {
        contextFor(database, request)
      },
      schema: {
        params: idParams,
        headers: {
          type: 'object',
          properties: {
            'x-file-name': { type: 'string', minLength: 1, maxLength: 2000 },
            'x-expected-version': { type: 'string', pattern: '^(0|[1-9][0-9]{0,8})$' }
          },
          required: ['x-file-name', 'x-expected-version']
        }
      }
    },
    async (request) => {
      let filename: string
      try {
        filename = decodeURIComponent(String(request.headers['x-file-name']))
      } catch {
        throw new BusinessError(400, 'INVALID_FILENAME', '文件名编码无效')
      }
      if (!Buffer.isBuffer(request.body))
        throw new BusinessError(415, 'INVALID_CONTENT_TYPE', '请上传 PNG/JPEG 二进制文件')
      return uploadAttachment(
        database,
        directory,
        contextFor(database, request),
        request.params.id,
        {
          name: filename,
          version: Number(request.headers['x-expected-version']),
          mimeType: String(request.headers['content-type']).split(';')[0]!,
          buffer: request.body
        },
        mutationKey(request),
        request.id
      )
    }
  )
  app.get<{ Params: { id: string } }>(
    '/attachments/:id',
    { schema: { params: idParams } },
    async (request) =>
      attachmentMetadata(database, contextFor(database, request), request.params.id, request.id)
  )
  for (const method of ['PATCH', 'DELETE'] as const) {
    app.route<{ Params: { id: string }; Body: { version: number; name?: string } }>({
      method,
      url: '/attachments/:id',
      schema: {
        params: idParams,
        body: objectSchema(
          {
            version: { type: 'integer', minimum: 1 },
            ...(method === 'PATCH'
              ? { name: { type: 'string', minLength: 1, maxLength: 200 } }
              : {})
          },
          method === 'PATCH' ? ['version', 'name'] : ['version']
        )
      },
      handler: async (request) =>
        editAttachment(
          database,
          contextFor(database, request),
          request.params.id,
          { ...request.body, delete: method === 'DELETE' },
          mutationKey(request),
          request.id
        )
    })
  }
  app.get<{ Params: { id: string }; Querystring: { version: number } }>(
    '/attachments/:id/content',
    {
      schema: {
        params: idParams,
        querystring: objectSchema({ version: { type: 'integer', minimum: 1 } }, ['version'])
      }
    },
    async (request, reply) => {
      const result = downloadAttachment(
        database,
        directory,
        contextFor(database, request),
        request.params.id,
        request.query.version,
        request.id
      )
      return reply
        .type(result.record.mimeType)
        .headers({
          'Cache-Control': 'no-store',
          'X-Content-Type-Options': 'nosniff',
          'Content-Security-Policy': "default-src 'none'; sandbox",
          'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(result.record.name)}`
        })
        .send(result.buffer)
    }
  )
}
