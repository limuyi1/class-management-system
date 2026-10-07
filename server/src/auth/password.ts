import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto'

import { BusinessError } from '../services/errors.js'

/** 密码不设复杂度或长度下限，只拒绝空白和纯数字；128 字符为接口长度上限。 */
export function validatePassword(password: string): void {
  if (!password.trim()) {
    throw new BusinessError(400, 'INVALID_PASSWORD', '密码不能为空')
  }
  if (password.length > 128) {
    throw new BusinessError(400, 'INVALID_PASSWORD', '密码不能超过 128 个字符')
  }
  if (/^\p{Decimal_Number}+$/u.test(password.trim())) {
    throw new BusinessError(400, 'INVALID_PASSWORD', '密码不能是纯数字')
  }
}

/** 使用 Node.js 内置 scrypt 实现；显式内存成本，格式保存盐和参数版本。 */
function derive(password: string, salt: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, 64, { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 }, (error, key) => {
      if (error) reject(error)
      else resolve(key)
    })
  })
}

/** 仅返回哈希，调用者不得记录原始密码或完整哈希。 */
export async function hashPassword(password: string): Promise<string> {
  validatePassword(password)
  const salt = randomBytes(16).toString('hex')
  return `scrypt-v1$${salt}$${(await derive(password, salt)).toString('hex')}`
}

/** 常量时间比较派生密钥；格式异常视为校验失败。 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const [algorithm, salt, expected] = hash.split('$')
  if (algorithm !== 'scrypt-v1' || !salt || !expected || expected.length !== 128) return false
  const key = await derive(password, salt)
  return timingSafeEqual(key, Buffer.from(expected, 'hex'))
}
