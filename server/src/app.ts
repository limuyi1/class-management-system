import { registerV5 } from './routes/v5.js'
import { registerManaged } from './routes/managed.js'
import { registerSetup } from './routes/setup.js'
import { registerReports } from './routes/reports.js'
import Fastify from 'fastify'
import { registerOpenAPI } from './routes/openapi.js'
import { registerStaticUi } from './routes/staticUi.js'
import { registerDataTools } from './routes/dataTools.js'
import { registerResources } from './routes/resources.js'
import { registerAICalls } from './routes/aiCalls.js'
import cookie from '@fastify/cookie'

import { attachmentDirectory, registerAttachments } from './routes/attachments.js'
import { registerAuth } from './routes/auth.js'
import { registerAccounts } from './routes/accounts.js'
import { registerDevices } from './routes/devices.js'
import { registerClassroomTools } from './routes/classroomTools.js'
import { registerTeaching } from './routes/teaching.js'
import { registerScores } from './routes/scores.js'
import { registerWorkspaces } from './routes/workspaces.js'
import { BusinessError } from './services/errors.js'
import type { DatabaseType } from './types/Account.js'
import type { FastifyError } from 'fastify'

/** 测试使用 app.inject，不需开启端口；生产仅同域反向代理，不开放任意 CORS。 */
export async function buildApp(
  database: DatabaseType,
  origin: string,
  storageDirectory = attachmentDirectory()
) {
  const app = Fastify({
    bodyLimit: 1024 * 1024,
    trustProxy:
      process.env.TRUST_PROXY?.split(',')
        .map((value) => value.trim())
        .filter(Boolean) || false,
    ajv: { customOptions: { removeAdditional: false } },
    logger: {
      redact: [
        'req.headers.x-managed-session',
        'req.headers.authorization',
        'req.headers.cookie',
        'res.headers.set-cookie',
        'req.body'
      ]
    }
  })
  await app.register(cookie)
  app.setErrorHandler<FastifyError>((error, request, reply) => {
    if (error instanceof BusinessError) {
      void reply.code(error.statusCode).send({
        code: error.code,
        message: error.message,
        details: error.details,
        requestId: request.id
      })
    } else if (error.statusCode === 413 || error.statusCode === 415) {
      void reply.code(error.statusCode).send({
        code: 'INVALID_FILE',
        message: error.statusCode === 413 ? '请求内容过大' : '不支持此文件类型',
        requestId: request.id
      })
    } else if (error.validation) {
      void reply
        .code(400)
        .send({ code: 'INVALID_INPUT', message: '请求参数不符合要求', requestId: request.id })
    } else {
      request.log.error({ requestId: request.id, errorName: error.name }, '服务处理失败')
      void reply
        .code(500)
        .send({ code: 'INTERNAL_ERROR', message: '服务暂时不可用', requestId: request.id })
    }
  })
  registerOpenAPI(app, database)
  app.get('/api/v1/health', async () => ({ ready: true }))
  await app.register(
    async (api) => {
      registerSetup(api, database, origin)
      await registerAuth(api, database, origin)
      registerAccounts(api, database)
      registerDevices(api, database)
      registerManaged(api, database)
      registerV5(api, database)
      registerWorkspaces(api, database)
      registerScores(api, database)
      registerTeaching(api, database)
      registerClassroomTools(api, database)
      registerAttachments(api, database, storageDirectory)
      registerAICalls(api, database, storageDirectory)
      registerResources(api, database, storageDirectory)
      registerDataTools(api, database)
      registerReports(api, database)
    },
    { prefix: '/api/v1' }
  )
  if (process.env.NODE_ENV === 'production') registerStaticUi(app)
  return app
}
