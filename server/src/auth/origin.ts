/** 开发环境允许同协议、同端口的本机地址互换；生产环境始终严格匹配配置来源。 */
export function isAllowedOrigin(
  actual: string | undefined,
  configured: string,
  production = process.env.NODE_ENV === 'production'
): boolean {
  if (!actual) return false
  if (actual === configured) return true
  if (production) return false
  try {
    const source = new URL(actual)
    const expected = new URL(configured)
    const loopback = new Set(['localhost', '127.0.0.1', '[::1]'])
    return (
      source.origin === actual &&
      expected.origin === configured &&
      ['http:', 'https:'].includes(source.protocol) &&
      source.protocol === expected.protocol &&
      source.port === expected.port &&
      loopback.has(source.hostname) &&
      loopback.has(expected.hostname)
    )
  } catch {
    return false
  }
}
