import { effectScope } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useApiScores } from '@/hooks/api/useApiScores'
import { apiRequest } from '@/api/client'
import { readScores } from '@/api/scores'
import type { ScoreStateType } from '@/types/ApiScores'

vi.mock('@/api/client', () => ({ apiRequest: vi.fn() }))
vi.mock('@/api/scores', () => ({ readScores: vi.fn() }))
afterEach(() => vi.clearAllMocks())
function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((yes) => {
    resolve = yes
  })
  return { promise, resolve }
}
const oldState = { workspace: { id: 'old', ownerId: 'first' } } as ScoreStateType
const newState = { workspace: { id: 'new', ownerId: 'second' } } as ScoreStateType

describe('API 成绩范围和失败重试', () => {
  it('切换账号和学期后拒绝晚到的旧成绩', async () => {
    const old = deferred<ScoreStateType>()
    vi.mocked(readScores).mockReturnValueOnce(old.promise).mockResolvedValueOnce(newState)
    let owner = 'first',
      workspace = 'old'
    const scope = effectScope()
    const api = scope.run(() =>
      useApiScores(
        () => owner,
        () => workspace
      )
    )!
    const pending = api.load()
    owner = 'second'
    workspace = 'new'
    api.clear()
    await api.load()
    old.resolve(oldState)
    await pending
    expect(api.state.value).toEqual(newState)
    expect(vi.mocked(readScores).mock.calls[1].slice(0, 2)).toEqual(['second', 'new'])
    scope.stop()
  })
  it('读取失败保留同一工作区快照；写入响应丢失后使用原范围和原幂等键重试', async () => {
    vi.mocked(readScores)
      .mockResolvedValueOnce(oldState)
      .mockRejectedValueOnce(new Error('读取失败'))
      .mockResolvedValueOnce(oldState)
    vi.mocked(apiRequest)
      .mockRejectedValueOnce(new Error('响应丢失'))
      .mockResolvedValueOnce({ items: [] })
    const scope = effectScope()
    const api = scope.run(() =>
      useApiScores(
        () => 'first',
        () => 'old'
      )
    )!
    await api.load()
    await expect(api.load()).rejects.toThrow('读取失败')
    expect(api.state.value).toEqual(oldState)
    const body = { items: [{ value: 0 }] }
    await expect(api.write('/workspaces/old/scores/batch', 'PATCH', body)).rejects.toThrow(
      '响应丢失'
    )
    await api.write('/workspaces/old/scores/batch', 'PATCH', body)
    const first = vi.mocked(apiRequest).mock.calls[0][1]
    const retry = vi.mocked(apiRequest).mock.calls[1][1]
    expect(first?.idempotencyKey).toBeTruthy()
    expect(retry?.idempotencyKey).toBe(first?.idempotencyKey)
    expect(retry?.ownerId).toBe('first')
    expect(api.saving.value).toBe(false)
    scope.stop()
  })
  it('组件销毁后写入完成不重新获取已离开账号的成绩', async () => {
    const result = deferred<unknown>()
    vi.mocked(apiRequest).mockReturnValueOnce(result.promise)
    const scope = effectScope()
    const api = scope.run(() =>
      useApiScores(
        () => 'first',
        () => 'old'
      )
    )!
    const pending = api.write('/workspaces/old/scores/batch', 'PATCH', { items: [] })
    scope.stop()
    result.resolve({ items: [] })
    await pending
    expect(readScores).not.toHaveBeenCalled()
  })
})
