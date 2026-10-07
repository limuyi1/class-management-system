import { transaction } from '../db/migrate.js'
import { readStudentReport, saveStudentReport } from '../services/reports/documents.js'
import { contextFor, objectSchema, mutationKey } from './helpers.js'
import type { DatabaseType } from '../types/Account.js'
import type { FastifyInstance } from 'fastify'
/** 报告正文不接受客户端上报分数或统计，只保存经审核的文字。 */
export function registerReports(app: FastifyInstance, database: DatabaseType): void {
  const uuid = { type: 'string', format: 'uuid' },
    params = objectSchema({ id: uuid, studentId: uuid }, ['id', 'studentId'])
  app.post<{ Params: { id: string }; Body: { students: string[]; props: string[] } }>(
    '/workspaces/:id/reports/preview',
    {
      schema: {
        params: objectSchema({ id: uuid }, ['id']),
        body: objectSchema(
          {
            students: { type: 'array', minItems: 1, maxItems: 50, uniqueItems: true, items: uuid },
            props: { type: 'array', maxItems: 200, items: { type: 'string', maxLength: 150 } }
          },
          ['students', 'props']
        )
      }
    },
    async (req) => {
      const context = contextFor(database, req)
      return transaction(database, () => ({
        items: req.body.students.map((studentId) => ({
          studentId,
          ...readStudentReport(
            database,
            context,
            req.params.id,
            studentId,
            req.body.props,
            req.id,
            true
          )
        }))
      }))
    }
  )
  app.get<{ Params: { id: string; studentId: string }; Querystring: { props?: string } }>(
    '/workspaces/:id/reports/:studentId',
    {
      schema: {
        params,
        querystring: objectSchema({ props: { type: 'string', maxLength: 15000 } }, [])
      }
    },
    async (req) =>
      readStudentReport(
        database,
        contextFor(database, req),
        req.params.id,
        req.params.studentId,
        req.query.props?.split(',').filter(Boolean) || [],
        req.id
      )
  )
  app.put<{
    Params: { id: string; studentId: string }
    Body: {
      text: string
      version: number
      workspaceVersion: number
      sourceVersion: string
      props?: string[]
    }
  }>(
    '/workspaces/:id/reports/:studentId',
    {
      schema: {
        params,
        body: objectSchema(
          {
            props: { type: 'array', maxItems: 200, items: { type: 'string', maxLength: 150 } },
            sourceVersion: { type: 'string', pattern: '^[0-9a-f]{64}$' },
            text: { type: 'string', maxLength: 20000 },
            version: { type: 'integer', minimum: 0 },
            workspaceVersion: { type: 'integer', minimum: 1 }
          },
          ['text', 'version', 'workspaceVersion', 'sourceVersion']
        )
      }
    },
    async (req) =>
      saveStudentReport(
        database,
        contextFor(database, req),
        req.params.id,
        req.params.studentId,
        req.body,
        mutationKey(req),
        req.id
      )
  )
}
