import { afterEach, expect, it, vi } from 'vitest'
import { apiRequest, setAccessToken } from '@/api/client'
afterEach(() => {
  vi.unstubAllGlobals()
  setAccessToken('')
})
it('图片上传使用原始 Blob 和固定账号头；二进制下载不尝试解析 JSON', async () => {
  const blob = new Blob(['png'], { type: 'image/png' })
  const fetchMock = vi
    .fn()
    .mockResolvedValueOnce(new Response(JSON.stringify({ version: 1 }), { status: 200 }))
    .mockResolvedValueOnce(new Response(blob, { status: 200 }))
  vi.stubGlobal('fetch', fetchMock)
  setAccessToken('test-token')
  await apiRequest('/attachments/id', {
    method: 'PUT',
    ownerId: 'owner',
    body: blob,
    fileName: '图片.png',
    expectedVersion: 0,
    idempotencyKey: 'same-key'
  })
  const options = fetchMock.mock.calls[0][1]
  expect(options.body).toBe(blob)
  expect(options.headers['Content-Type']).toBe('image/png')
  expect(options.headers['X-File-Name']).toBe(encodeURIComponent('图片.png'))
  expect(options.headers['X-Expected-Version']).toBe('0')
  expect(options.headers['X-Managed-Account-Id']).toBe('owner')
  const result = await apiRequest<Blob>('/attachments/id/content?version=1', {
    ownerId: 'owner',
    responseType: 'blob'
  })
  expect(await result.text()).toBe('png')
})
it('二进制请求权限失败仍解析 JSON 错误，不创建可下载内容', async () => {
  vi.stubGlobal(
    'fetch',
    vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ code: 'FORBIDDEN', message: '代管已关闭' }), { status: 403 })
      )
  )
  await expect(
    apiRequest('/attachments/id/content?version=1', { responseType: 'blob' })
  ).rejects.toThrow('代管已关闭')
})
