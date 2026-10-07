import { effectScope } from 'vue'
import { afterEach, expect, it, vi } from 'vitest'
import { apiRequest, ApiRequestError } from '@/api/client'
import { useApiAttachments } from '@/hooks/api/useApiAttachments'
import type { AttachmentType } from '@/types/ApiAttachments'
vi.mock('@/api/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/api/client')>()),
  apiRequest: vi.fn()
}))
afterEach(() => {
  vi.clearAllMocks()
  vi.restoreAllMocks()
})
const record: AttachmentType = {
  id: 'image',
  name: '图片.png',
  mimeType: 'image/png',
  size: 10,
  width: 1,
  height: 1,
  version: 1,
  createdAt: 0,
  updatedAt: 0
}
it('响应丢失后保留原文件、ID 和幂等键，成功后清除待上传队列', async () => {
  const scope = effectScope(),
    state = scope.run(() => useApiAttachments(() => 'owner'))!
  const file = new File(['png'], '图片.png', { type: 'image/png' })
  state.select([file])
  vi.mocked(apiRequest)
    .mockRejectedValueOnce(new Error('响应丢失'))
    .mockResolvedValueOnce(record)
    .mockResolvedValueOnce({ items: [record], total: 1 })
  await expect(state.upload()).rejects.toThrow('响应丢失')
  expect(state.hasDraft.value).toBe(true)
  await state.upload()
  const calls = vi.mocked(apiRequest).mock.calls
  expect(calls[0][0]).toBe(calls[1][0])
  expect(calls[0][1]?.idempotencyKey).toBe(calls[1][1]?.idempotencyKey)
  expect(calls[1][1]?.body).toBe(file)
  expect(calls[1][1]?.ownerId).toBe('owner')
  expect(state.queue.value).toEqual([])
  scope.stop()
})
it('账号切换后晚到的列表和图片不回填，也不创建旧账号预览 URL', async () => {
  let owner = 'old'
  const scope = effectScope(),
    state = scope.run(() => useApiAttachments(() => owner))!
  let finish!: (value: unknown) => void
  vi.mocked(apiRequest).mockReturnValueOnce(
    new Promise((resolve) => {
      finish = resolve
    })
  )
  const pending = state.load()
  owner = 'new'
  state.reset()
  finish({ items: [record], total: 1 })
  await pending
  expect(state.items.value).toEqual([])
  const create = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test')
  vi.mocked(apiRequest).mockReturnValueOnce(
    new Promise((resolve) => {
      finish = resolve
    })
  )
  const preview = state.content(record)
  scope.stop()
  finish(new Blob(['png']))
  await preview
  expect(create).not.toHaveBeenCalled()
})
it('文件类型和体积不合规不能进入待上传队列；关闭预览释放 URL', async () => {
  const scope = effectScope(),
    state = scope.run(() => useApiAttachments(() => 'owner'))!
  expect(() => state.select([new File(['svg'], '图片.svg', { type: 'image/svg+xml' })])).toThrow(
    'PNG/JPEG'
  )
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test')
  const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
  vi.mocked(apiRequest)
    .mockResolvedValueOnce(new Blob(['png']))
    .mockResolvedValueOnce(record)
  await state.content(record)
  state.closePreview()
  expect(revoke).toHaveBeenCalledWith('blob:test')
  expect(state.previewUrl.value).toBe('')
  scope.stop()
})

it('收到代管撤权错误后清除已有预览和列表', async () => {
  const scope = effectScope(),
    state = scope.run(() => useApiAttachments(() => 'owner'))!
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test')
  const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
  vi.mocked(apiRequest)
    .mockResolvedValueOnce(new Blob(['png']))
    .mockResolvedValueOnce(record)
  await state.content(record)
  state.items.value = [record]
  vi.mocked(apiRequest).mockRejectedValueOnce(new ApiRequestError('FORBIDDEN', '代管已关闭', 403))
  await expect(state.load()).rejects.toThrow('代管已关闭')
  expect(state.items.value).toEqual([])
  expect(state.previewUrl.value).toBe('')
  expect(revoke).toHaveBeenCalledWith('blob:test')
  scope.stop()
})
