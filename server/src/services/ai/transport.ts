import { request as requestHttp } from 'node:http'
import { request as requestHttps } from 'node:https'
import { BusinessError } from '../errors.js'

/** 通过 HTTP/HTTPS 请求模型，支持内网及自定义端口；限制超时和响应大小，无请求体时使用 GET。 */
export async function requestAIJson(
  url: URL,
  headers: Record<string, string>,
  body: unknown,
  signal?: AbortSignal
): Promise<unknown> {
  const listing = body === undefined
  const incomplete = () =>
    new BusinessError(
      502,
      listing ? 'AI_MODELS_UNAVAILABLE' : 'AI_CALL_UNCERTAIN',
      listing ? '模型列表请求失败，请稍后重试' : '模型请求未完成，用量需核对'
    )
  if (!['http:', 'https:'].includes(url.protocol))
    throw new BusinessError(400, 'INVALID_AI_URL', '模型地址须使用 HTTP 或 HTTPS')
  const request = url.protocol === 'http:' ? requestHttp : requestHttps
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => req.destroy(new Error('timeout')), listing ? 30000 : 120000)
    const req = request(
      url,
      {
        method: listing ? 'GET' : 'POST',
        agent: false,
        signal,
        headers: { ...headers, 'Content-Type': 'application/json' }
      },
      (response) => {
        const chunks: Buffer[] = []
        let size = 0
        response.on('data', (chunk: Buffer) => {
          size += chunk.length
          if (size > 4 * 1024 * 1024) {
            req.destroy(new Error('response limit'))
            return
          }
          chunks.push(chunk)
        })
        response.on('error', () => {
          clearTimeout(timer)
          reject(incomplete())
        })
        response.on('end', () => {
          clearTimeout(timer)
          if (response.statusCode !== 200) {
            reject(new BusinessError(502, 'AI_PROVIDER_REJECTED', '模型服务未成功响应，请检查配置'))
            return
          }
          try {
            resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')))
          } catch {
            reject(new BusinessError(502, 'AI_INVALID_RESPONSE', '模型响应格式无效'))
          }
        })
      }
    )
    req.on('error', () => {
      clearTimeout(timer)
      reject(incomplete())
    })
    req.end(listing ? undefined : JSON.stringify(body))
  })
}
