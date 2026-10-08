import { requireAdmin, requireTeachingOwner } from '../../policies/access.js'
import { mutate, validateContext } from '../mutations.js'
import { BusinessError } from '../errors.js'
import { decryptAIKey, encryptAIKey } from './secrets.js'
import { quotaFor } from './quota.js'
import type {
  AIConfigType,
  AIConfigInputType,
  AISettingsType
} from '../../../../packages/shared/src/AI.js'
import type { AccessContextType, AccountRecordType, DatabaseType } from '../../types/Account.js'

interface ConfigRecordType extends Omit<AIConfigType, 'apiKey' | 'configured' | 'enabled'> {
  secret: string | null
  enabled: number
}
function validateIdentity(database: DatabaseType, context: AccessContextType): void {
  validateContext(database, context)
  if (context.ownerId !== context.actor.id && !context.managedSessionId)
    throw new BusinessError(400, 'INVALID_CONTEXT', 'AI 配置不支持账号代管')
}
const emptyConfig = (): AIConfigType => ({
  provider: 'OPENAI',
  baseUrl: '',
  model: '',
  configured: false,
  enabled: false,
  version: 0
})
/** 默认读取配置摘要；已授权的编辑接口可显式读取密钥，幂等回执仍只保存摘要。 */
export function configFor(database: DatabaseType, id: string, includeKey = false): AIConfigType {
  const row = database.prepare('SELECT * FROM ai_configs WHERE id=?').get(id) as
    | ConfigRecordType
    | undefined
  return row
    ? {
        provider: row.provider,
        baseUrl: row.baseUrl,
        model: row.model,
        ...(includeKey ? { apiKey: row.secret ? decryptAIKey(row.secret) : '' } : {}),
        configured: Boolean(row.secret),
        enabled: Boolean(row.enabled),
        version: row.version
      }
    : { ...emptyConfig(), ...(includeKey ? { apiKey: '' } : {}) }
}
/** 平台管理在提交时校验有效身份，完整代管期间拒绝管理员能力。 */
export function validateAIAdmin(database: DatabaseType, context: AccessContextType): void {
  validateIdentity(database, context)
  if (context.managedSessionId) throw new BusinessError(403, 'FORBIDDEN', '当前用户无平台管理权限')
  requireAdmin(
    database.prepare('SELECT * FROM users WHERE id=?').get(context.ownerId) as AccountRecordType
  )
}
/** 默认采用平台额度；个人配置保留，显式切换后才使用自己的 Key。 */
export function readAISettings(
  database: DatabaseType,
  context: AccessContextType,
  includeKey = false
): AISettingsType {
  validateIdentity(database, context)
  requireTeachingOwner(database, context.ownerId)
  const preference = database
    .prepare('SELECT mode,version FROM ai_preferences WHERE ownerId=?')
    .get(context.ownerId) as { mode: AISettingsType['mode']; version: number } | undefined
  const platform = configFor(database, 'platform')
  return {
    mode: preference?.mode || 'PLATFORM',
    version: preference?.version || 0,
    personal: configFor(database, context.ownerId, includeKey),
    platform: {
      model: platform.model,
      baseUrl: platform.baseUrl,
      provider: platform.provider,
      enabled: platform.enabled,
      configured: platform.configured
    },
    quota: quotaFor(database, context.ownerId)
  }
}
/** 规范化 HTTP/HTTPS 基础地址，支持域名、IP、内网地址和自定义端口。 */
export function normalizeAIEndpoint(value: string): string {
  let url: URL
  try {
    url = new URL(value.trim())
  } catch {
    throw new BusinessError(400, 'INVALID_AI_URL', '模型地址无效')
  }
  if (!['http:', 'https:'].includes(url.protocol))
    throw new BusinessError(400, 'INVALID_AI_URL', '模型地址须使用 HTTP 或 HTTPS')
  if (url.username || url.password || url.search || url.hash)
    throw new BusinessError(400, 'INVALID_AI_URL', '请填写不含凭据、查询参数和片段的 API 基础地址')
  return url.toString().replace(/\/$/, '')
}
/** 个人只能使用管理员已允许的服务地址，可自选模型和个人 Key，不开放任意代理地址。 */
export function saveAIConfig(
  database: DatabaseType,
  context: AccessContextType,
  input: AIConfigInputType,
  platform: boolean,
  key: string,
  requestId: string
): AIConfigType {
  validateIdentity(database, context)
  const baseUrl = normalizeAIEndpoint(input.baseUrl)
  const model = input.model.trim()
  if (!model || model.length > 120 || !/^[\w.\-/:]+$/.test(model))
    throw new BusinessError(400, 'INVALID_AI_MODEL', '模型名称无效')
  if (
    input.apiKey !== undefined &&
    input.apiKey !== null &&
    (!input.apiKey.trim() || input.apiKey.length > 2000)
  )
    throw new BusinessError(400, 'INVALID_AI_KEY', '密钥不能为空')
  const encrypted = typeof input.apiKey === 'string' ? encryptAIKey(input.apiKey.trim()) : null
  const id = platform ? 'platform' : context.ownerId
  return mutate(database, context, 'AI_CONFIG_CHANGE', id, input, key, requestId, () => {
    if (platform) validateAIAdmin(database, context)
    else {
      requireTeachingOwner(database, context.ownerId)
      const allowed = configFor(database, 'platform')
      if (allowed.baseUrl !== baseUrl || allowed.provider !== input.provider)
        throw new BusinessError(
          400,
          'AI_ENDPOINT_NOT_ALLOWED',
          '个人 Key 请使用管理员配置的模型服务地址'
        )
    }
    const old = database.prepare('SELECT * FROM ai_configs WHERE id=?').get(id) as
      | ConfigRecordType
      | undefined
    if ((old?.version || 0) !== input.version)
      throw new BusinessError(409, 'VERSION_CONFLICT', 'AI 配置已变化，请刷新后重试')
    const secret = input.apiKey === null ? null : encrypted || old?.secret || null
    if (input.enabled && !secret)
      throw new BusinessError(400, 'AI_KEY_REQUIRED', '启用前请配置 Key')
    database
      .prepare(
        `INSERT INTO ai_configs VALUES(?,?,?,?,?,?,?,?,?)
      ON CONFLICT(id) DO UPDATE SET provider=excluded.provider,baseUrl=excluded.baseUrl,
      model=excluded.model,secret=excluded.secret,enabled=excluded.enabled,
      version=excluded.version,updatedAt=excluded.updatedAt`
      )
      .run(
        id,
        platform ? null : id,
        input.provider,
        baseUrl,
        model,
        secret,
        Number(input.enabled),
        input.version + 1,
        Date.now()
      )
    return configFor(database, id)
  })
}
/** 额度不足不会自动切换个人 Key，个人 Key 失败也不会自动消耗平台额度。 */
export function saveAIMode(
  database: DatabaseType,
  context: AccessContextType,
  input: { mode: AISettingsType['mode']; version: number },
  key: string,
  requestId: string
): AISettingsType {
  validateIdentity(database, context)
  requireTeachingOwner(database, context.ownerId)
  return mutate(database, context, 'AI_MODE_CHANGE', context.ownerId, input, key, requestId, () => {
    const old = database
      .prepare('SELECT version FROM ai_preferences WHERE ownerId=?')
      .get(context.ownerId) as { version: number } | undefined
    if ((old?.version || 0) !== input.version)
      throw new BusinessError(409, 'VERSION_CONFLICT', 'AI 使用方式已变化，请刷新')
    const config = configFor(database, input.mode === 'PLATFORM' ? 'platform' : context.ownerId)
    if (input.mode === 'PERSONAL' && (!config.configured || !config.enabled))
      throw new BusinessError(400, 'AI_NOT_CONFIGURED', '请先配置并启用个人 Key')
    database
      .prepare(
        `INSERT INTO ai_preferences VALUES(?,?,?)
      ON CONFLICT(ownerId) DO UPDATE SET mode=excluded.mode,version=excluded.version`
      )
      .run(context.ownerId, input.mode, input.version + 1)
    return readAISettings(database, context)
  })
}
