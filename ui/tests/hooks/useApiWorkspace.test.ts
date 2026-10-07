import { effectScope } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useApiWorkspace } from '@/hooks/api/useApiWorkspace'
import { apiRequest } from '@/api/client'

vi.mock('@/api/client', () => ({ apiRequest: vi.fn() }))
afterEach(() => vi.clearAllMocks())

/** 延迟响应模拟真实竞态，而不是只验证同步 ref 赋值。 */
function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: Error) => void
  const promise = new Promise<T>((yes, no) => {
    resolve = yes
    reject = no
  })
  return { promise, resolve, reject }
}
describe('API 工作区切换', () => {
  it('旧账号晚到的响应不能覆盖新账号目录和名单', async () => {
    const old = deferred<unknown>()
    vi.mocked(apiRequest).mockReturnValueOnce(old.promise).mockResolvedValueOnce({ items: [] })
    const scope = effectScope()
    const state = scope.run(() => useApiWorkspace('old-owner'))!
    const reading = state.loadCatalog()
    await state.switchOwner('new-owner')
    old.resolve({ items: [{ id: 'old-workspace' }] })
    await reading
    expect(state.ownerId.value).toBe('new-owner')
    expect(state.catalog.value).toEqual([])
    expect(state.workspace.value).toBeNull()
    scope.stop()
  })
  it('切换等待已发起写入，写失败保留原账号', async () => {
    const write = deferred<unknown>()
    vi.mocked(apiRequest).mockReturnValueOnce(write.promise)
    const scope = effectScope()
    const state = scope.run(() => useApiWorkspace('original'))!
    const saving = state.write('/workspaces', 'POST', {}, 'stable-key')
    const saveCheck = expect(saving).rejects.toThrow('网络中断')
    const switching = state.switchOwner('other')
    const switchCheck = expect(switching).rejects.toThrow('网络中断')
    expect(state.ownerId.value).toBe('original')
    write.reject(new Error('网络中断'))
    await Promise.all([saveCheck, switchCheck])
    expect(state.ownerId.value).toBe('original')
    expect(vi.mocked(apiRequest).mock.calls[0][1]).toMatchObject({
      ownerId: 'original',
      idempotencyKey: 'stable-key'
    })
    scope.stop()
  })
  it('目录成功但名单失败仍向调用者报告，禁止显示保存成功', async () => {
    vi.mocked(apiRequest)
      .mockResolvedValueOnce({ items: [{ id: 'workspace' }] })
      .mockRejectedValueOnce(new Error('名单读取失败'))
    const scope = effectScope()
    const state = scope.run(() => useApiWorkspace('owner'))!
    await expect(state.loadCatalog()).rejects.toThrow('名单读取失败')
    expect(state.loadError.value).toBe('名单读取失败')
    expect(state.loading.value).toBe(false)
    scope.stop()
  })
})
