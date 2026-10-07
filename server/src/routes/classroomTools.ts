import {
  deleteClassroomTool,
  readClassroomTools,
  saveClassroomTool
} from '../services/classroomTools.js'
import { contextFor, idParams, mutationKey, objectSchema } from './helpers.js'
import { toolBodySchema } from './classroomToolSchemas.js'
import type { FastifyInstance } from 'fastify'
import type { DatabaseType } from '../types/Account.js'
import type {
  ClassroomToolContentType,
  ClassroomToolKindType
} from '../../../packages/shared/src/ClassroomTools.js'

/** 工具只接收固定业务结构；额外 owner/role 字段直接拒绝。 */
export function registerClassroomTools(app: FastifyInstance, database: DatabaseType): void {
  const params = objectSchema(
    { id: { type: 'string', format: 'uuid' }, toolId: { type: 'string', format: 'uuid' } },
    ['id', 'toolId']
  )
  app.get<{ Params: { id: string } }>(
    '/workspaces/:id/tools',
    { schema: { params: idParams } },
    async (request) =>
      readClassroomTools(database, contextFor(database, request), request.params.id, request.id)
  )
  app.put<{
    Params: { id: string; toolId: string }
    Body: {
      expectedVersion: number
      kind: ClassroomToolKindType
      content: ClassroomToolContentType
    }
  }>(
    '/workspaces/:id/tools/:toolId',
    { schema: { params, body: toolBodySchema } },
    async (request) =>
      saveClassroomTool(
        database,
        contextFor(database, request),
        request.params.id,
        request.params.toolId,
        request.body,
        mutationKey(request),
        request.id
      )
  )
  app.delete<{ Params: { id: string; toolId: string }; Body: { version: number } }>(
    '/workspaces/:id/tools/:toolId',
    {
      schema: {
        params,
        body: objectSchema({ version: { type: 'integer', minimum: 1 } }, ['version'])
      }
    },
    async (request) =>
      deleteClassroomTool(
        database,
        contextFor(database, request),
        request.params.id,
        request.params.toolId,
        request.body.version,
        mutationKey(request),
        request.id
      )
  )
}
