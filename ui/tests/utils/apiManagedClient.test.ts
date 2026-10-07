import { afterEach, expect, it, vi } from 'vitest'
import {
  apiRequest,
  hasPendingAccountWrites,
  setAccessToken,
  setManagedSession
} from '@/api/client'

afterEach(() => {
  vi.unstubAllGlobals()
  setAccessToken('')
  setManagedSession('')
})
it('完整上下文用于业务和个人设置，认证与切换控制明确使用真实身份', async () => {
  const fetchMock = vi.fn().mockImplementation(async () => new Response('{}'))
  vi.stubGlobal('fetch', fetchMock)
  setAccessToken('real-token')
  setManagedSession('teacher-session')
  await apiRequest('/me/ai')
  await apiRequest('/resources?kind=settings', { ownerId: 'teacher' })
  await apiRequest('/auth/logout', { method: 'POST', actorOnly: true })
  expect(fetchMock.mock.calls[0][1].headers['X-Managed-Session']).toBe('teacher-session')
  expect(fetchMock.mock.calls[1][1].headers['X-Managed-Account-Id']).toBe('teacher')
  expect(fetchMock.mock.calls[2][1].headers['X-Managed-Session']).toBeUndefined()
})
it('旧账号的迟到响应不会进入新页面，提交期间阻止切换', async () => {
  let resolve!: (response: Response) => void
  vi.stubGlobal(
    'fetch',
    vi.fn(
      () =>
        new Promise<Response>((done) => {
          resolve = done
        })
    )
  )
  setManagedSession('old-session')
  const write = apiRequest('/me/profile', { method: 'PATCH', body: { nickname: 'old' } })
  const rejection = expect(write).rejects.toMatchObject({ code: 'CONTEXT_CHANGED' })
  expect(hasPendingAccountWrites()).toBe(true)
  setManagedSession('new-session')
  resolve(new Response('{"nickname":"old"}'))
  await rejection
  expect(hasPendingAccountWrites()).toBe(false)
})
it('401 刷新只使用真实身份，原请求重试保留目标会话', async () => {
  const fetchMock = vi
    .fn()
    .mockResolvedValueOnce(new Response('{}', { status: 401 }))
    .mockResolvedValueOnce(new Response('{"accessToken":"refreshed"}'))
    .mockResolvedValueOnce(new Response('{"mode":"PERSONAL"}'))
  vi.stubGlobal('fetch', fetchMock)
  setManagedSession('teacher-session')
  expect(await apiRequest('/me/ai')).toEqual({ mode: 'PERSONAL' })
  expect(fetchMock.mock.calls[1][0]).toBe('/api/v1/auth/refresh')
  expect(fetchMock.mock.calls[1][1].headers['X-Managed-Session']).toBeUndefined()
  expect(fetchMock.mock.calls[2][1].headers['X-Managed-Session']).toBe('teacher-session')
})
it('目标失效会通知布局退出代管，不自动访问管理员数据', async () => {
  const handler = vi.fn()
  window.addEventListener('managed-session-invalid', handler)
  vi.stubGlobal(
    'fetch',
    vi.fn(
      async () =>
        new Response('{"code":"MANAGED_SESSION_INVALID","message":"代管已失效"}', { status: 403 })
    )
  )
  setManagedSession('teacher-session')
  await expect(apiRequest('/me/context')).rejects.toThrow('代管已失效')
  expect(handler).toHaveBeenCalledOnce()
  window.removeEventListener('managed-session-invalid', handler)
})
