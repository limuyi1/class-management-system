import { actorFor } from './helpers.js'
import type { FastifyInstance, FastifySchema } from 'fastify'
import type { DatabaseType } from '../types/Account.js'
/** 收集真实注册的 JSON Schema 并生成 OpenAPI 3.1；只开放给已登录账号。 */
export function registerOpenAPI(app: FastifyInstance, database: DatabaseType): void {
  const paths: Record<string, Record<string, unknown>> = {}
  app.addHook('onRoute', (route) => {
    if (!route.url.startsWith('/api/v1/') || route.url.includes('openapi')) return
    const url = route.url.replace(/:([\w]+)/g, '{$1}'),
      schema = route.schema as FastifySchema | undefined
    const methods = Array.isArray(route.method) ? route.method : [route.method]
    paths[url] ||= {}
    for (const method of methods) {
      if (method === 'HEAD') continue
      const parameters: unknown[] = []
      for (const [field, location] of [
        ['params', 'path'],
        ['querystring', 'query'],
        ['headers', 'header']
      ] as const) {
        const object = schema?.[field] as
          | { properties?: Record<string, unknown>; required?: string[] }
          | undefined
        for (const [name, value] of Object.entries(object?.properties || {}))
          parameters.push({
            name,
            in: location,
            required: location === 'path' || Boolean(object?.required?.includes(name)),
            schema: value
          })
      }
      paths[url]![method.toLowerCase()] = {
        summary: route.url,
        parameters,
        security: [
          '/api/v1/health',
          '/api/v1/setup/status',
          '/api/v1/setup/admin',
          '/api/v1/auth/login',
          '/api/v1/auth/captcha/challenges',
          '/api/v1/auth/captcha/verify',
          '/api/v1/auth/refresh'
        ].includes(route.url)
          ? []
          : [{ bearerAuth: [] }],
        ...(schema?.body
          ? {
              requestBody: {
                required: true,
                content: { 'application/json': { schema: schema.body } }
              }
            }
          : {}),
        responses: {
          200: { description: '成功响应，字段契约见 packages/shared；二进制接口返回文件' },
          400: { description: '输入校验失败' },
          401: { description: '登录失效' },
          403: { description: '无权限' },
          409: { description: '版本或幂等冲突' }
        }
      }
    }
  })
  app.get('/api/v1/openapi.json', async (req) => {
    actorFor(database, req)
    return {
      openapi: '3.1.0',
      info: { title: '班务管理系统 API', version: '6.0.0' },
      paths,
      components: { securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer' } } }
    }
  })
}
