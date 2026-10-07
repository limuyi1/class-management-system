import { readLegacyNotice } from '../services/legacyNotice.js'
import { readComments, writeComments } from '../services/comments.js'
import { readTeachingSnapshot, saveNotice } from '../services/notice.js'
import { contextFor, idParams, mutationKey, objectSchema } from './helpers.js'
import type { DatabaseType } from '../types/Account.js'
import type { FastifyInstance } from 'fastify'
import type { CommentChangeType, NoticeConfigType } from '../../../packages/shared/src/Teaching.js'

const uuid = { type: 'string', format: 'uuid' }
const version = { type: 'integer', minimum: 0 }
const mark = { type: 'number', minimum: 0, maximum: 100000 }
/** 教学接口拒绝任意类型的文档、owner 和服务端生成状态的批量赋值。 */
export function registerTeaching(app: FastifyInstance, database: DatabaseType): void {
  app.get<{ Params: { id: string } }>(
    '/workspaces/:id/legacy-notice',
    { schema: { params: idParams } },
    async (request) =>
      readLegacyNotice(database, contextFor(database, request), request.params.id, request.id)
  )
  app.get<{ Params: { id: string } }>(
    '/workspaces/:id/comments',
    { schema: { params: idParams } },
    async (request) =>
      readComments(database, contextFor(database, request), request.params.id, request.id)
  )
  app.patch<{ Params: { id: string }; Body: { items: CommentChangeType[] } }>(
    '/workspaces/:id/comments/batch',
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
                  text: { type: 'string', maxLength: 5000 },
                  expectedVersion: version
                },
                ['studentId', 'text', 'expectedVersion']
              )
            }
          },
          ['items']
        )
      }
    },
    async (request) =>
      writeComments(
        database,
        contextFor(database, request),
        request.params.id,
        request.body.items,
        mutationKey(request),
        request.id
      )
  )
  app.get<{ Params: { id: string } }>(
    '/workspaces/:id/exports/snapshot',
    { schema: { params: idParams } },
    async (request) =>
      readTeachingSnapshot(database, contextFor(database, request), request.params.id, request.id)
  )
  app.put<{ Params: { id: string }; Body: { expectedVersion: number; config: NoticeConfigType } }>(
    '/workspaces/:id/notice',
    {
      schema: {
        params: idParams,
        body: objectSchema(
          {
            expectedVersion: version,
            config: objectSchema(
              {
                title: { type: 'string', minLength: 1, maxLength: 120 },
                noticeDate: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
                mode: { type: 'string', enum: ['score', 'grade'] },
                subjects: {
                  type: 'array',
                  maxItems: 100,
                  items: objectSchema(
                    {
                      assessmentId: uuid,
                      maxScore: { ...mark, exclusiveMinimum: 0 },
                      gradeAMin: mark,
                      gradeBMin: mark
                    },
                    ['assessmentId', 'maxScore', 'gradeAMin', 'gradeBMin']
                  )
                }
              },
              ['title', 'noticeDate', 'mode', 'subjects']
            )
          },
          ['expectedVersion', 'config']
        )
      }
    },
    async (request) =>
      saveNotice(
        database,
        contextFor(database, request),
        request.params.id,
        request.body,
        mutationKey(request),
        request.id
      )
  )
}
