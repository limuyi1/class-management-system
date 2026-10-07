import { lookup } from 'node:dns/promises'
import { request } from 'node:https'
import { isIP } from 'node:net'
import { BusinessError } from '../errors.js'

/** 拒绝私网、保留地址及 IPv4 映射；IPv6 仅允许普通全球单播。 */
export function isPublicAddress(address: string): boolean {
  if (isIP(address) === 6) {
    address = new URL(`http://[${address}]/`).hostname.slice(1, -1)
    return (
      /^[23][0-9a-f]{3}:/i.test(address) &&
      !/^2001:(db8|0?|10|20):/i.test(address) &&
      !/^2002:/i.test(address)
    )
  }
  if (isIP(address) !== 4) return false
  const [a, b, c] = address.split('.').map(Number) as [number, number, number]
  return !(
    a === 0 ||
    a === 10 ||
    a === 127 ||
    a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && (b === 168 || b === 0 || (b === 88 && c === 99))) ||
    (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) ||
    (a === 203 && b === 0 && c === 113)
  )
}
/** DNS 一次解析并固定连接 IP，保留原域名 TLS 校验；拒绝重定向与过大响应。 */
export async function requestAIJson(
  url: URL,
  headers: Record<string, string>,
  body: unknown,
  signal?: AbortSignal
): Promise<unknown> {
  if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443'))
    throw new BusinessError(400, 'AI_ENDPOINT_NOT_ALLOWED', '模型仅允许 HTTPS 443 服务')
  let dnsTimer: ReturnType<typeof setTimeout> | undefined
  const addresses = await Promise.race([
    lookup(url.hostname, { all: true }),
    new Promise<never>((_resolve, reject) => {
      dnsTimer = setTimeout(
        () => reject(new BusinessError(502, 'AI_DNS_TIMEOUT', '模型域名解析超时')),
        15000
      )
    })
  ]).finally(() => clearTimeout(dnsTimer))
  if (!addresses.length || addresses.some((item) => !isPublicAddress(item.address)))
    throw new BusinessError(400, 'AI_ENDPOINT_NOT_ALLOWED', '模型域名解析到非公网地址')
  const address = addresses[0]!
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => req.destroy(new Error('timeout')), 120000)
    const req = request(
      url,
      {
        method: 'POST',
        agent: false,
        signal,
        headers: { ...headers, 'Content-Type': 'application/json' },
        lookup: (_hostname, options, callback) => {
          if (options.all) callback(null, [address])
          else callback(null, address.address, address.family)
        }
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
          reject(new BusinessError(502, 'AI_CALL_UNCERTAIN', '模型响应中断，用量需核对'))
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
      reject(new BusinessError(502, 'AI_CALL_UNCERTAIN', '模型请求未完成，用量需核对'))
    })
    req.end(JSON.stringify(body))
  })
}
