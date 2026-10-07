/** Access Token 仅保存在当前页面内存；Cookie 由后端管理，业务代码无法读取。 */
let accessToken = ''
let refreshing: Promise<void> | null = null
let managedToken = ''
let contextVersion = 0
let pendingWrites = 0

/** 切换全局有效身份，所有已发出的旧上下文响应随后作废。 */
export function setManagedSession(token: string): void {
  managedToken = token
  contextVersion++
}

/** 账号切换前等待所有提交、上传和 AI 请求结束。 */
export function hasPendingAccountWrites(): boolean {
  return pendingWrites > 0
}

/** 当前是否使用老师的完整工作台，改密与设备下线不会清空管理员令牌。 */
export function isManagingAccount(): boolean {
  return Boolean(managedToken)
}

export class ApiRequestError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number,
    public details?: unknown
  ) {
    super(message)
  }
}

/** 登录成功后设置短期令牌；退出/改密后立即清空。 */
export function setAccessToken(token: string): void {
  accessToken = token
}

/** 刷新接口只走本人认证上下文；同一页面合并并发、多标签页使用浏览器锁协调。 */
export async function refreshAccessToken(): Promise<void> {
  if (refreshing) return refreshing
  const perform = async (): Promise<void> => {
    const response = await fetch('/api/v1/auth/refresh', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'X-CSRF-Protection': '1' }
    })
    if (!response.ok) {
      accessToken = ''
      throw new ApiRequestError('UNAUTHENTICATED', '请重新登录', response.status)
    }
    const result = (await response.json()) as { accessToken: string }
    accessToken = result.accessToken
  }
  refreshing = (
    navigator.locks ? navigator.locks.request('cms-refresh', perform) : perform()
  ).finally(() => {
    refreshing = null
  })
  return refreshing
}

/** 发起请求时捕获有效会话，重试保持同一账号；旧上下文的响应全部作废。 */
export async function apiRequest<T>(
  path: string,
  options: {
    actorOnly?: boolean
    managedToken?: string
    contextVersion?: number
    method?: string
    body?: unknown
    ownerId?: string
    idempotencyKey?: string
    signal?: AbortSignal
    responseType?: 'blob'
    fileName?: string
    expectedVersion?: number
  } = {},
  retry = true
): Promise<T> {
  // 重试保留第一次请求的会话，禁止刷新令牌后随全局账号改变。
  options = {
    ...options,
    managedToken: options.actorOnly ? '' : (options.managedToken ?? managedToken),
    contextVersion: options.contextVersion ?? contextVersion
  }
  const headers: Record<string, string> = { 'X-CSRF-Protection': '1' }
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`
  const binary = options.body instanceof Blob
  if (options.body !== undefined)
    headers['Content-Type'] = binary ? (options.body as Blob).type : 'application/json'
  if (options.fileName !== undefined) headers['X-File-Name'] = encodeURIComponent(options.fileName)
  if (options.expectedVersion !== undefined)
    headers['X-Expected-Version'] = String(options.expectedVersion)
  if (options.managedToken) headers['X-Managed-Session'] = options.managedToken
  if (options.ownerId) headers['X-Managed-Account-Id'] = options.ownerId
  if (options.idempotencyKey) headers['Idempotency-Key'] = options.idempotencyKey
  const writes = Boolean(options.method && options.method !== 'GET')
  if (writes) pendingWrites++
  try {
    const response = await fetch(`/api/v1${path}`, {
      method: options.method || 'GET',
      headers,
      credentials: 'same-origin',
      signal: options.signal,
      body: binary
        ? (options.body as Blob)
        : options.body !== undefined
          ? JSON.stringify(options.body)
          : undefined
    })
    if (options.contextVersion !== contextVersion)
      throw new ApiRequestError('CONTEXT_CHANGED', '账号已切换，忽略之前的响应', 409)
    if (response.status === 401 && retry && !path.startsWith('/auth/')) {
      try {
        await refreshAccessToken()
      } catch (error) {
        if (options.managedToken && options.managedToken === managedToken)
          window.dispatchEvent(new Event('managed-session-invalid'))
        throw error
      }
      if (options.contextVersion !== contextVersion)
        throw new ApiRequestError('CONTEXT_CHANGED', '账号已切换，忽略之前的响应', 409)
      return apiRequest<T>(path, options, false)
    }
    if (response.ok && options.responseType === 'blob') {
      const blob = await response.blob()
      if (options.contextVersion !== contextVersion)
        throw new ApiRequestError('CONTEXT_CHANGED', '账号已切换，忽略之前的响应', 409)
      return blob as T
    }
    const result = await response.json()
    if (options.contextVersion !== contextVersion)
      throw new ApiRequestError('CONTEXT_CHANGED', '账号已切换，忽略之前的响应', 409)
    if (
      !response.ok &&
      result.code === 'MANAGED_SESSION_INVALID' &&
      options.managedToken === managedToken
    )
      window.dispatchEvent(new Event('managed-session-invalid'))
    if (!response.ok)
      throw new ApiRequestError(
        result.code || 'REQUEST_FAILED',
        result.message || '请求失败',
        response.status,
        result.details
      )
    if (options.contextVersion !== contextVersion)
      throw new ApiRequestError('CONTEXT_CHANGED', '账号已切换，忽略之前的响应', 409)
    return result as T
  } finally {
    if (writes) pendingWrites--
  }
}
