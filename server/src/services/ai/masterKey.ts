import { randomBytes } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { validateAIMasterKey } from './secrets.js'
import type { DatabaseType } from '../../types/Account.js'

/** 首次启动生成独立主密钥文件；旧密文原样保留，缺失原密钥不阻断业务启动。 */
export function initializeAIMasterKey(database: DatabaseType, databasePath: string): void {
  if (process.env.AI_ENCRYPTION_KEY) {
    validateAIMasterKey(process.env.AI_ENCRYPTION_KEY)
    return
  }
  const path = resolve(
    process.env.AI_ENCRYPTION_KEY_FILE || join(dirname(resolve(databasePath)), '.ai-encryption-key')
  )
  if (!existsSync(path)) {
    const encrypted = database
      .prepare("SELECT id FROM ai_configs WHERE secret IS NOT NULL AND secret != '' LIMIT 1")
      .get()
    if (encrypted)
      console.warn(
        '原 AI 主密钥未找到，将生成新主密钥；旧配置保留，请重新填写 API Key 或恢复原主密钥'
      )
    mkdirSync(dirname(path), { recursive: true })
    try {
      writeFileSync(path, randomBytes(32).toString('base64') + '\n', { flag: 'wx', mode: 0o600 })
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error
    }
  }
  const value = readFileSync(path, 'utf8').trim()
  validateAIMasterKey(value)
  process.env.AI_ENCRYPTION_KEY = value
}
