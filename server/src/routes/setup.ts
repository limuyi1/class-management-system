import { isAllowedOrigin } from '../auth/origin.js'
import { rateLimit } from '../auth/limits.js'
import { createInitialAdmin, needsInitialAdmin } from '../services/setup.js'
import { BusinessError } from '../services/errors.js'
import { objectSchema, mutationKey } from './helpers.js'
import type { DatabaseType } from '../types/Account.js'
import type { InitialAdminInputType } from '../../../packages/shared/src/Setup.js'
import type { FastifyInstance, FastifyRequest } from 'fastify'

/** 首次管理员只允许本机开发入口创建；使用真实连接地址，不能伪造转发头绕过。 */
function localSetupAllowed(request: FastifyRequest): boolean {
  return (
    process.env.NODE_ENV !== 'production' &&
    ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(request.raw.socket.remoteAddress || '')
  )
}
/** 匿名状态不含任何账号信息；创建接口校验来源、代管头和实际连接地址。 */
export function registerSetup(app: FastifyInstance, database: DatabaseType, origin: string): void {
  app.get('/setup/status', async (_request, reply) => {
    reply.header('Cache-Control', 'no-store')
    return { required: needsInitialAdmin(database), available: localSetupAllowed(_request) }
  })
  app.post<{ Body: InitialAdminInputType }>(
    '/setup/admin',
    {
      schema: {
        body: objectSchema(
          {
            phone: { type: 'string', maxLength: 11 },
            nickname: { type: 'string', maxLength: 30 },
            initialPassword: { type: 'string', minLength: 1, maxLength: 128 }
          },
          ['phone', 'initialPassword']
        )
      }
    },
    async (request, reply) => {
      reply.header('Cache-Control', 'no-store')
      if (!localSetupAllowed(request))
        throw new BusinessError(
          403,
          'SETUP_LOCAL_ONLY',
          '首次设置请在服务器本机进行；生产部署使用管理员初始化命令'
        )
      if (
        !isAllowedOrigin(request.headers.origin, origin) ||
        request.headers['x-csrf-protection'] !== '1'
      )
        throw new BusinessError(403, 'INVALID_ORIGIN', '请求来源无效')
      if (request.headers['x-managed-account-id'])
        throw new BusinessError(400, 'INVALID_CONTEXT', '首次设置不支持账号代管')
      rateLimit(database, `setup:${request.raw.socket.remoteAddress}`, 10, 60000)
      return createInitialAdmin(database, request.body, mutationKey(request), request.id)
    }
  )
}
