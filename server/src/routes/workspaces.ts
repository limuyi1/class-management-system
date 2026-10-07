import { registerRosterRoutes } from './roster.js'
import { deleteWorkspace } from '../services/workspaceDelete.js'
import { transaction } from '../db/migrate.js'
import { getWorkspace } from '../repositories/workspaces.js'
import { audit } from '../services/accounts.js'
import { validateContext } from '../services/mutations.js'
import { createWorkspace, editWorkspace, listWorkspaces } from '../services/workspaces.js'
import { listEnrollments } from '../services/students.js'
import { BusinessError } from '../services/errors.js'
import { actorFor, contextFor, idParams, mutationKey, objectSchema, textSchema } from './helpers.js'
import type { DatabaseType } from '../types/Account.js'
import type { FastifyInstance } from 'fastify'
import type { CreateWorkspaceType } from '../../../packages/shared/src/Workspace.js'

const uuid = { type: 'string', format: 'uuid' }
const version = { type: 'integer', minimum: 1 }
const workspaceFields = {
  className: textSchema,
  termName: textSchema,
  scoreFullMark: { type: 'number', exclusiveMinimum: 0, maximum: 100000 }
}

/** 业务路由统一解析 owner，角色/账号切换不能绕过资源归属及首登改密。 */
export function registerWorkspaces(app: FastifyInstance, database: DatabaseType): void {
  app.delete<{ Params: { id: string }; Body: { version: number; wholeClass: boolean } }>(
    '/workspaces/:id',
    {
      schema: {
        params: idParams,
        body: objectSchema({ version, wholeClass: { type: 'boolean' } }, ['version', 'wholeClass'])
      }
    },
    async (request) =>
      deleteWorkspace(
        database,
        contextFor(database, request),
        request.params.id,
        request.body.version,
        request.body.wholeClass,
        mutationKey(request),
        request.id
      )
  )
  app.get<{ Querystring: { search?: string; page?: number } }>(
    '/admin/managed-accounts',
    {
      schema: {
        querystring: objectSchema(
          {
            search: { type: 'string', maxLength: 30 },
            page: { type: 'integer', minimum: 1, maximum: 100000 }
          },
          []
        )
      }
    },
    async (request) => {
      const actor = actorFor(database, request)
      if (actor.role !== 'ADMIN' || !actor.superVip)
        throw new BusinessError(403, 'FORBIDDEN', '请先开启账号代管')
      const pattern = `%${request.query.search || ''}%`
      const items = database
        .prepare(
          `SELECT id,nickname,substr(phone,-4) AS phoneSuffix,status FROM users
      WHERE role='USER' AND status!='DELETED' AND (nickname LIKE ? OR phone LIKE ?) ORDER BY createdAt,id LIMIT 50 OFFSET ?`
        )
        .all(pattern, pattern, ((request.query.page || 1) - 1) * 50)
      return { items }
    }
  )
  app.get('/workspaces', async (request) => {
    const context = contextFor(database, request)
    const items = listWorkspaces(database, context)
    if (context.actor.id !== context.ownerId)
      audit(
        database,
        context.actor.id,
        context.ownerId,
        'WORKSPACES_READ',
        context.ownerId,
        request.id
      )
    return { items }
  })
  app.post<{ Body: CreateWorkspaceType }>(
    '/workspaces',
    {
      schema: {
        body: objectSchema({ ...workspaceFields, classId: uuid }, ['className', 'termName'])
      }
    },
    async (request) =>
      createWorkspace(
        database,
        contextFor(database, request),
        request.body,
        mutationKey(request),
        request.id
      )
  )
  app.patch<{ Params: { id: string }; Body: CreateWorkspaceType & { version: number } }>(
    '/workspaces/:id',
    {
      schema: {
        params: idParams,
        body: objectSchema({ ...workspaceFields, version }, ['className', 'termName', 'version'])
      }
    },
    async (request) =>
      editWorkspace(
        database,
        contextFor(database, request),
        request.params.id,
        request.body,
        mutationKey(request),
        request.id
      )
  )
  app.get<{ Params: { id: string } }>(
    '/workspaces/:id/state',
    { schema: { params: idParams } },
    async (request) => {
      const context = contextFor(database, request)
      validateContext(database, context)
      // 读取和代管审计使用同一短事务，外部 SQLite 写入也不能插入两次读取之间。
      const result = transaction(database, () => {
        const snapshot = {
          workspace: getWorkspace(database, context.ownerId, request.params.id),
          students: listEnrollments(database, context.ownerId, request.params.id)
        }
        if (context.actor.id !== context.ownerId)
          audit(
            database,
            context.actor.id,
            context.ownerId,
            'WORKSPACE_READ',
            request.params.id,
            request.id
          )
        return snapshot
      })
      return result
    }
  )
  registerRosterRoutes(app, database)
}
