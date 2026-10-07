import { readFile } from 'node:fs/promises'
import { resolve, extname } from 'node:path'
import type { FastifyInstance } from 'fastify'
const types: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.otf': 'font/otf'
}
/** 仅生产模式提供 ui/dist，API 404 不回退 HTML，绝不公开数据库或附件目录。 */
export function registerStaticUi(app: FastifyInstance, directory = resolve('../ui/dist')): void {
  app.get<{ Params: { '*': string } }>('/*', async (req, reply) => {
    const raw = req.params['*'] || 'index.html'
    if (raw.startsWith('api/') || raw.includes('..') || raw.includes('\\') || raw.startsWith('.'))
      return reply.code(404).send({ code: 'NOT_FOUND', message: '资源不存在' })
    const path = resolve(directory, raw)
    if (!path.startsWith(directory + '/')) return reply.code(404).send()
    try {
      const bytes = await readFile(path)
      return reply
        .type(types[extname(path)] || 'application/octet-stream')
        .header('Cache-Control', raw === 'index.html' ? 'no-cache' : 'public, max-age=86400')
        .send(bytes)
    } catch {
      return reply.code(404).send({ code: 'NOT_FOUND', message: '资源不存在' })
    }
  })
}
