import { audit } from '../services/accounts.js'
import { validateContext } from '../services/mutations.js'
import {
  addStudent,
  deleteStudent,
  editStudent,
  historicalStudents,
  listEnrollments
} from '../services/students.js'
import { promoteWorkspace, transferStudent } from '../services/rosterLifecycle.js'
import { contextFor, idParams, mutationKey, objectSchema, textSchema } from './helpers.js'
import type { DatabaseType } from '../types/Account.js'
import type { FastifyInstance } from 'fastify'
import type { EditEnrollmentType } from '../../../packages/shared/src/Workspace.js'
const uuid = { type: 'string', format: 'uuid' },
  version = { type: 'integer', minimum: 1 }
const studentParams = objectSchema({ id: uuid, studentId: uuid }, ['id', 'studentId'])
/** 名单及生命周期路由明确传递操作者与数据归属。 */
export function registerRosterRoutes(app: FastifyInstance, database: DatabaseType): void {
  app.get('/students/history', async (request) => {
    const context = contextFor(database, request)
    validateContext(database, context)
    const items = historicalStudents(database, context.ownerId)
    if (context.actor.id !== context.ownerId)
      audit(
        database,
        context.actor.id,
        context.ownerId,
        'HISTORICAL_ROSTER_READ',
        context.ownerId,
        request.id
      )
    return { items }
  })
  app.get<{ Params: { id: string } }>(
    '/workspaces/:id/students',
    { schema: { params: idParams } },
    async (request) => {
      const context = contextFor(database, request)
      validateContext(database, context)
      const items = listEnrollments(database, context.ownerId, request.params.id)
      if (context.actor.id !== context.ownerId)
        audit(
          database,
          context.actor.id,
          context.ownerId,
          'ROSTER_READ',
          request.params.id,
          request.id
        )
      return { items }
    }
  )
  app.post<{ Params: { id: string }; Body: { name: string; studentId?: string } }>(
    '/workspaces/:id/students',
    {
      schema: {
        params: idParams,
        body: objectSchema({ name: textSchema, studentId: uuid }, ['name'])
      }
    },
    async (request) =>
      addStudent(
        database,
        contextFor(database, request),
        request.params.id,
        request.body,
        mutationKey(request),
        request.id
      )
  )
  app.patch<{ Params: { id: string; studentId: string }; Body: EditEnrollmentType }>(
    '/workspaces/:id/students/:studentId',
    {
      schema: {
        params: studentParams,
        body: objectSchema(
          {
            name: textSchema,
            disabled: { type: 'boolean' },
            departed: { type: 'boolean' },
            version
          },
          ['name', 'disabled', 'departed', 'version']
        )
      }
    },
    async (request) =>
      editStudent(
        database,
        contextFor(database, request),
        request.params.id,
        request.params.studentId,
        request.body,
        mutationKey(request),
        request.id
      )
  )
  app.delete<{ Params: { id: string; studentId: string }; Body: { version: number } }>(
    '/workspaces/:id/students/:studentId',
    {
      schema: { params: studentParams, body: objectSchema({ version }, ['version']) }
    },
    async (request) =>
      deleteStudent(
        database,
        contextFor(database, request),
        request.params.id,
        request.params.studentId,
        request.body.version,
        mutationKey(request),
        request.id
      )
  )
  app.post<{
    Params: { id: string }
    Body: {
      className: string
      termName: string
      version: number
      inheritStudents: boolean
      inheritAssessments?: boolean
    }
  }>(
    '/workspaces/:id/promote',
    {
      schema: {
        params: idParams,
        body: objectSchema(
          {
            className: textSchema,
            termName: textSchema,
            version,
            inheritStudents: { type: 'boolean' },
            inheritAssessments: { type: 'boolean' }
          },
          ['className', 'termName', 'version', 'inheritStudents']
        )
      }
    },
    async (request) =>
      promoteWorkspace(
        database,
        contextFor(database, request),
        request.params.id,
        request.body,
        mutationKey(request),
        request.id
      )
  )
  app.post<{
    Params: { id: string }
    Body: { studentId: string; targetId: string; version: number }
  }>(
    '/workspaces/:id/transfers',
    {
      schema: {
        params: idParams,
        body: objectSchema({ studentId: uuid, targetId: uuid, version }, [
          'studentId',
          'targetId',
          'version'
        ])
      }
    },
    async (request) =>
      transferStudent(
        database,
        contextFor(database, request),
        request.params.id,
        request.body,
        mutationKey(request),
        request.id
      )
  )
}
