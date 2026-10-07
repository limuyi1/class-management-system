import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'
import { BusinessError } from '../errors.js'

function masterKey(): Buffer {
  const value = process.env.AI_ENCRYPTION_KEY || ''
  const key = Buffer.from(value, 'base64')
  if (key.length !== 32 || key.toString('base64') !== value)
    throw new BusinessError(503, 'AI_KEY_UNAVAILABLE', '请先配置服务器 AI 加密主密钥')
  return key
}
/** AES-256-GCM 随机 nonce；主密钥放服务器环境中，并与数据库备份分开保管。 */
export function encryptAIKey(value: string): string {
  const nonce = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', masterKey(), nonce)
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()])
  return [nonce, cipher.getAuthTag(), encrypted].map((part) => part.toString('base64')).join('.')
}
/** 仅供服务端模型适配器解密，异常不暴露密文、主密钥或第三方错误详情。 */
export function decryptAIKey(value: string): string {
  const key = masterKey()
  try {
    const parts = value.split('.').map((part) => Buffer.from(part, 'base64'))
    if (parts.length !== 3) throw new Error('format')
    const decipher = createDecipheriv('aes-256-gcm', key, parts[0]!)
    decipher.setAuthTag(parts[1]!)
    return Buffer.concat([decipher.update(parts[2]!), decipher.final()]).toString('utf8')
  } catch {
    throw new BusinessError(503, 'AI_KEY_UNAVAILABLE', 'AI 密钥无法读取，请联系管理员')
  }
}
