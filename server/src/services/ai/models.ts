import { BusinessError } from '../errors.js'
import { configFor, normalizeAIEndpoint, readAISettings, validateAIAdmin } from './settings.js'
import { decryptAIKey } from './secrets.js'
import { requestAIJson } from './transport.js'
import type { AIModelQueryType } from '../../../../packages/shared/src/AI.js'
import type { AccessContextType, DatabaseType } from '../../types/Account.js'

/** 获取当前服务的模型目录；已保存密钥仅用于原服务，个人查询不允许任意服务地址。 */
export async function listAIModels(
  database: DatabaseType,
  context: AccessContextType,
  input: AIModelQueryType,
  platform: boolean,
  requestJson = requestAIJson
): Promise<string[]> {
  const authorize = (): void => {
    if (platform) validateAIAdmin(database, context)
    else {
      const settings = readAISettings(database, context)
      if (settings.platform.baseUrl !== baseUrl || settings.platform.provider !== input.provider)
        throw new BusinessError(400, 'AI_ENDPOINT_NOT_ALLOWED', '请使用管理员配置的模型服务地址')
    }
  }
  // 权限必须先于地址解析和密钥读取。
  if (platform) validateAIAdmin(database, context)
  else readAISettings(database, context)
  const baseUrl = normalizeAIEndpoint(input.baseUrl.trim())
  authorize()
  const id = platform ? 'platform' : context.ownerId
  const saved = configFor(database, id)
  let key = input.apiKey?.trim() || ''
  if (!key) {
    if (saved.baseUrl !== baseUrl || saved.provider !== input.provider)
      throw new BusinessError(
        400,
        'AI_KEY_REQUIRED',
        '服务地址或类型已修改，请填写对应的 API Key 后刷新'
      )
    const record = database.prepare('SELECT secret FROM ai_configs WHERE id=?').get(id) as
      | { secret: string | null }
      | undefined
    if (!record?.secret)
      throw new BusinessError(400, 'AI_KEY_REQUIRED', '请填写 API Key 后刷新模型')
    key = decryptAIKey(record.secret)
  }
  const headers: Record<string, string> =
    input.provider === 'GEMINI' ? { 'x-goog-api-key': key } : { Authorization: `Bearer ${key}` }
  const items = new Set<string>()
  let pageToken = ''
  const tokens = new Set<string>()
  for (let page = 0; page < 10; page++) {
    const url = new URL(`${baseUrl}/models`)
    if (input.provider === 'GEMINI') {
      url.searchParams.set('pageSize', '1000')
      if (pageToken) url.searchParams.set('pageToken', pageToken)
    }
    const result = await requestJson(url, headers, undefined)
    if (!result || typeof result !== 'object') throw invalidModels()
    const data = result as { data?: unknown; models?: unknown; nextPageToken?: unknown }
    const models = input.provider === 'GEMINI' ? data.models : data.data
    if (!Array.isArray(models)) throw invalidModels()
    for (const entry of models) {
      if (!entry || typeof entry !== 'object') continue
      const model = entry as { id?: unknown; name?: unknown; supportedGenerationMethods?: unknown }
      if (
        input.provider === 'GEMINI' &&
        Array.isArray(model.supportedGenerationMethods) &&
        !model.supportedGenerationMethods.includes('generateContent')
      )
        continue
      const name = input.provider === 'GEMINI' ? model.name : model.id
      if (typeof name !== 'string') continue
      const normalized = input.provider === 'GEMINI' ? name.replace(/^models\//, '') : name
      if (normalized.length <= 120 && /^[\w.\-/:]+$/.test(normalized)) items.add(normalized)
    }
    if (input.provider !== 'GEMINI' || !data.nextPageToken) {
      authorize()
      return [...items].sort((left, right) => left.localeCompare(right, 'en', { numeric: true }))
    }
    if (typeof data.nextPageToken !== 'string' || tokens.has(data.nextPageToken))
      throw invalidModels()
    pageToken = data.nextPageToken
    tokens.add(pageToken)
  }
  throw new BusinessError(502, 'AI_MODELS_LIMIT', '模型列表分页过多，请手动填写模型名称')
}

function invalidModels(): BusinessError {
  return new BusinessError(
    502,
    'AI_INVALID_RESPONSE',
    '模型列表格式无效，请检查服务地址或手动填写模型名称'
  )
}
