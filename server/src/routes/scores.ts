import { transaction } from '../db/migrate.js'
import { getWorkspace } from '../repositories/workspaces.js'
import { listAssessments } from '../repositories/scores.js'
import { createAssessment, deleteAssessment, editAssessment } from '../services/assessments.js'
import { writeScores } from '../services/scores.js'
import { readScoreState } from '../services/scoreProjection.js'
import { setReferences } from '../services/scoreReferences.js'
import { validateContext } from '../services/mutations.js'
import { audit } from '../services/accounts.js'
import { contextFor, idParams, mutationKey, objectSchema } from './helpers.js'
import type { DatabaseType } from '../types/Account.js'
import type { FastifyInstance } from 'fastify'
import type {
  AssessmentInputType,
  ReferenceInputType,
  ScoreChangeType
} from '../../../packages/shared/src/Scores.js'

const uuid = { type: 'string', format: 'uuid' }
const version = { type: 'integer', minimum: 1 }
const fields = {
  label: { type: 'string', minLength: 1, maxLength: 60 },
  disabled: { type: 'boolean' },
  fullMark: { anyOf: [{ type: 'null' }, { type: 'number', exclusiveMinimum: 0, maximum: 100000 }] },
  sortIndex: { type: 'integer', minimum: 0, maximum: 10000 }
}
const assessmentParams = objectSchema({ id: uuid, assessmentId: uuid }, ['id', 'assessmentId'])
const referenceSchema = {
  type: 'array',
  maxItems: 100,
  items: objectSchema({ sourceWorkspaceId: uuid, assessmentId: uuid }, [
    'sourceWorkspaceId',
    'assessmentId'
  ])
}
/** 路由严格拒绝额外 owner/role/reference 字段；Service 再验证所属学期与版本。 */
export function registerScores(app: FastifyInstance, database: DatabaseType): void {
  app.get<{ Params: { id: string } }>(
    '/workspaces/:id/scores',
    { schema: { params: idParams } },
    async (request) =>
      readScoreState(database, contextFor(database, request), request.params.id, request.id)
  )
  app.get<{ Params: { id: string } }>(
    '/workspaces/:id/assessments',
    { schema: { params: idParams } },
    async (request) => {
      const context = contextFor(database, request)
      return transaction(database, () => {
        validateContext(database, context)
        getWorkspace(database, context.ownerId, request.params.id)
        const items = listAssessments(database, context.ownerId, request.params.id)
        if (context.actor.id !== context.ownerId)
          audit(
            database,
            context.actor.id,
            context.ownerId,
            'ASSESSMENTS_READ',
            request.params.id,
            request.id
          )
        return { items }
      })
    }
  )
  app.post<{ Params: { id: string }; Body: AssessmentInputType }>(
    '/workspaces/:id/assessments',
    {
      schema: {
        params: idParams,
        body: objectSchema(
          { ...fields, prop: { type: 'string', minLength: 1, maxLength: 80 } },
          Object.keys(fields)
        )
      }
    },
    async (request) =>
      createAssessment(
        database,
        contextFor(database, request),
        request.params.id,
        request.body,
        mutationKey(request),
        request.id
      )
  )
  app.patch<{
    Params: { id: string; assessmentId: string }
    Body: AssessmentInputType & { version: number }
  }>(
    '/workspaces/:id/assessments/:assessmentId',
    {
      schema: {
        params: assessmentParams,
        body: objectSchema({ ...fields, version }, [...Object.keys(fields), 'version'])
      }
    },
    async (request) =>
      editAssessment(
        database,
        contextFor(database, request),
        request.params.id,
        request.params.assessmentId,
        request.body,
        mutationKey(request),
        request.id
      )
  )
  app.delete<{ Params: { id: string; assessmentId: string }; Body: { version: number } }>(
    '/workspaces/:id/assessments/:assessmentId',
    { schema: { params: assessmentParams, body: objectSchema({ version }, ['version']) } },
    async (request) =>
      deleteAssessment(
        database,
        contextFor(database, request),
        request.params.id,
        request.params.assessmentId,
        request.body.version,
        mutationKey(request),
        request.id
      )
  )
  app.patch<{ Params: { id: string }; Body: { items: ScoreChangeType[] } }>(
    '/workspaces/:id/scores/batch',
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
                  value: {
                    anyOf: [{ type: 'number', minimum: -1e9, maximum: 1e9 }, { type: 'null' }]
                  },
                  expectedVersion: { type: 'integer', minimum: 0 }
                },
                ['studentId', 'assessmentId', 'value', 'expectedVersion']
              )
            }
          },
          ['items']
        )
      }
    },
    async (request) =>
      writeScores(
        database,
        contextFor(database, request),
        request.params.id,
        request.body.items,
        mutationKey(request),
        request.id
      )
  )
  app.get<{ Params: { id: string } }>(
    '/workspaces/:id/references',
    { schema: { params: idParams } },
    async (request) => {
      const state = readScoreState(
        database,
        contextFor(database, request),
        request.params.id,
        request.id
      )
      return { version: state.workspace.version, items: state.references }
    }
  )
  app.put<{ Params: { id: string }; Body: { version: number; items: ReferenceInputType[] } }>(
    '/workspaces/:id/references',
    {
      schema: {
        params: idParams,
        body: objectSchema({ version, items: referenceSchema }, ['version', 'items'])
      }
    },
    async (request) =>
      setReferences(
        database,
        contextFor(database, request),
        request.params.id,
        request.body,
        mutationKey(request),
        request.id
      )
  )
}
