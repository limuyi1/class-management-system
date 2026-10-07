import { readExamPrint, compareNames } from '../services/printTools.js'
import { readScoreState } from '../services/scoreProjection.js'
import { readAnalysis } from '../services/analysis.js'
import { contextFor, objectSchema, idParams, mutationKey } from './helpers.js'
import { convertExcel } from '../services/excel.js'
import { storeImportRows, previewImport, commitImport } from '../services/imports.js'
import { readTeachingSnapshot } from '../services/notice.js'
import { getWorkspace } from '../repositories/workspaces.js'
import { validateContext } from '../services/mutations.js'
import { BusinessError } from '../services/errors.js'
import type { ImportMappingType } from '../services/imports.js'
import type { DatabaseType } from '../types/Account.js'
import type { FastifyInstance } from 'fastify'
/** 纯数据导出和导入统一后端，图片/PDF 继续复用浏览器排版。 */
export function registerDataTools(app: FastifyInstance, database: DatabaseType): void {
  app.get<{ Params: { id: string } }>(
    '/workspaces/:id/analysis',
    { schema: { params: idParams } },
    async (req) => readAnalysis(database, contextFor(database, req), req.params.id, req.id)
  )
  app.get<{ Params: { id: string }; Querystring: { assessmentId: string } }>(
    '/workspaces/:id/exam-print',
    {
      schema: {
        params: idParams,
        querystring: objectSchema({ assessmentId: { type: 'string', format: 'uuid' } }, [
          'assessmentId'
        ])
      }
    },
    async (req) =>
      readExamPrint(
        database,
        contextFor(database, req),
        req.params.id,
        req.query.assessmentId,
        req.id
      )
  )
  app.post<{ Params: { id: string }; Body: { baseline?: string[]; comparison: string[] } }>(
    '/workspaces/:id/compare-names',
    {
      schema: {
        params: idParams,
        body: objectSchema(
          {
            baseline: {
              type: 'array',
              maxItems: 2000,
              items: { type: 'string', minLength: 1, maxLength: 60 }
            },
            comparison: {
              type: 'array',
              maxItems: 2000,
              items: { type: 'string', minLength: 1, maxLength: 60 }
            }
          },
          ['comparison']
        )
      }
    },
    async (req) => {
      const state = readScoreState(database, contextFor(database, req), req.params.id, req.id)
      return compareNames(
        req.body.baseline ||
          state.students.filter((row) => !row.disabled && !row.departed).map((row) => row.name),
        req.body.comparison
      )
    }
  )
  app.addContentTypeParser(
    [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel'
    ],
    { parseAs: 'buffer', bodyLimit: 8 * 1024 * 1024 },
    (_req, body, done) => done(null, body)
  )
  app.post<{ Params: { id: string }; Body: Buffer }>(
    '/workspaces/:id/imports/file',
    {
      bodyLimit: 8 * 1024 * 1024,
      onRequest: async (req) => {
        contextFor(database, req)
      },
      schema: { params: idParams }
    },
    async (req) => {
      const context = contextFor(database, req)
      if (!Buffer.isBuffer(req.body))
        throw new BusinessError(400, 'INVALID_EXCEL', '请上传 Excel 二进制文件')
      const converted = await convertExcel('read', req.body)
      validateContext(database, context)
      const rows = converted.rows || [],
        id = storeImportRows(database, context, req.params.id, rows)
      return { id, rows }
    }
  )
  const column = { type: 'integer', minimum: 0, maximum: 199 },
    nullable = { anyOf: [column, { type: 'null' }] }
  app.post<{ Params: { id: string }; Body: ImportMappingType }>(
    '/imports/:id/preview',
    {
      schema: {
        params: idParams,
        body: objectSchema(
          {
            kind: { type: 'string', enum: ['scores', 'comments', 'roster'] },
            idColumn: nullable,
            nameColumn: column,
            commentColumn: nullable,
            headerRow: { type: 'integer', minimum: 0, maximum: 20 },
            fields: {
              type: 'array',
              maxItems: 200,
              items: objectSchema({ column, assessmentId: { type: 'string', format: 'uuid' } }, [
                'column',
                'assessmentId'
              ])
            }
          },
          ['idColumn', 'nameColumn', 'commentColumn', 'headerRow', 'fields']
        )
      }
    },
    async (req) => previewImport(database, contextFor(database, req), req.params.id, req.body)
  )
  app.post<{ Params: { id: string }; Body: { kind: 'scores' | 'comments' | 'roster' } }>(
    '/imports/:id/commit',
    {
      schema: {
        params: idParams,
        body: objectSchema({ kind: { type: 'string', enum: ['scores', 'comments', 'roster'] } }, [
          'kind'
        ])
      }
    },
    async (req) =>
      commitImport(
        database,
        contextFor(database, req),
        req.params.id,
        req.body.kind,
        mutationKey(req),
        req.id
      )
  )
  app.get<{
    Params: { id: string }
    Querystring: { kind: 'scores' | 'comments'; format: 'xlsx' | 'csv' }
  }>(
    '/workspaces/:id/export',
    {
      schema: {
        params: idParams,
        querystring: objectSchema(
          {
            kind: { type: 'string', enum: ['scores', 'comments'] },
            format: { type: 'string', enum: ['xlsx', 'csv'] }
          },
          ['kind', 'format']
        )
      }
    },
    async (req, reply) => {
      const context = contextFor(database, req),
        snapshot = readTeachingSnapshot(database, context, req.params.id, req.id)
      const assessments = snapshot.scores.assessments.filter((row) => !row.disabled)
      const comments = new Map(snapshot.comments.map((row) => [row.studentId, row.text]))
      const cells = new Map(
        snapshot.scores.scores.map((row) => [`${row.studentId}:${row.assessmentId}`, row.value])
      )
      const headers = [
        '序号',
        '学生ID',
        '姓名',
        ...(req.query.kind === 'comments'
          ? []
          : assessments.map(
              (row) =>
                `${row.label}（满分 ${row.fullMark ?? snapshot.scores.workspace.scoreFullMark}）`
            )),
        '评语'
      ]
      const rows = snapshot.scores.students
        .filter((student) => !student.disabled && !student.departed)
        .map((student, index) => [
          index + 1,
          student.studentId,
          student.name,
          ...(req.query.kind === 'comments'
            ? []
            : assessments.map(
                (assessment) => cells.get(`${student.studentId}:${assessment.id}`) ?? null
              )),
          comments.get(student.studentId) || ''
        ])
      let bytes: Buffer
      if (req.query.format === 'xlsx') {
        const result = await convertExcel('write', [headers, ...rows])
        bytes = Buffer.from(result.bytes!)
      } else
        bytes = Buffer.from(
          '\ufeff' +
            [headers, ...rows]
              .map((row) =>
                row
                  .map((value) => {
                    const text = String(value ?? '')
                    return (
                      '"' +
                      (/^[=+\-@\t\r]/.test(text) ? "'" + text : text).replace(/"/g, '""') +
                      '"'
                    )
                  })
                  .join(',')
              )
              .join('\r\n')
        )
      validateContext(database, context)
      getWorkspace(database, context.ownerId, req.params.id)
      reply.headers({
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
        'Content-Disposition': `attachment; filename="teaching.${req.query.format}"`
      })
      return reply
        .type(
          req.query.format === 'xlsx'
            ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            : 'text/csv; charset=utf-8'
        )
        .send(bytes)
    }
  )
}
