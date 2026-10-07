import { effectScope, ref } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useTeachingExport } from '@/hooks/api/useTeachingExport'
import { readTeachingSnapshot } from '@/api/teaching'
import { apiRequest } from '@/api/client'
import { downloadBlob } from '@/utils/downloadUtil'
import { createScoreNoticePdf } from '@/utils/score-notice/scoreNoticePdfUtil'
import { renderScoreNoticeBlob } from '@/utils/score-notice/scoreNoticeImageUtil'
import { teachingFixture } from '../fixtures/apiTeaching'

vi.mock('@/api/teaching', () => ({ readTeachingSnapshot: vi.fn() }))
vi.mock('@/api/client', () => ({ apiRequest: vi.fn() }))
vi.mock('@/utils/score-notice/scoreNoticeImageUtil', () => ({ renderScoreNoticeBlob: vi.fn() }))
vi.mock('@/utils/score-notice/scoreNoticePdfUtil', () => ({ createScoreNoticePdf: vi.fn() }))
vi.mock('@/utils/downloadUtil', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/utils/downloadUtil')>()),
  downloadBlob: vi.fn()
}))
afterEach(() => {
  vi.clearAllMocks()
  vi.unstubAllGlobals()
})

describe('教学导出范围与取消', () => {
  it('Excel 每次重新获取当前授权快照，权限失败不下载旧缓存', async () => {
    vi.mocked(readTeachingSnapshot)
      .mockResolvedValueOnce(teachingFixture())
      .mockResolvedValueOnce(teachingFixture())
      .mockRejectedValueOnce(new Error('代管已关闭'))
    vi.mocked(apiRequest).mockResolvedValue(new Blob(['xlsx']))
    const scope = effectScope()
    const output = scope.run(() =>
      useTeachingExport(
        () => 'owner',
        () => 'current',
        ref()
      )
    )!
    await output.run('scores')
    expect(readTeachingSnapshot).toHaveBeenCalledWith('owner', 'current')
    expect(apiRequest).toHaveBeenCalledWith('/workspaces/current/export?kind=scores&format=xlsx', { ownerId: 'owner', responseType: 'blob' })
    expect(downloadBlob).toHaveBeenCalledWith(expect.any(Blob), '403_下学期_成绩.xlsx')
    await expect(output.run('scores')).rejects.toThrow('代管已关闭')
    expect(downloadBlob).toHaveBeenCalledTimes(1)
    expect(output.exporting.value).toBe(false)
    scope.stop()
  })
  it('PDF 打包期间离开账号，不再下载上一账号的导出文件', async () => {
    vi.mocked(readTeachingSnapshot).mockResolvedValue(teachingFixture())
    vi.mocked(renderScoreNoticeBlob).mockResolvedValue(new Blob(['png']))
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callback(0)
      return 1
    })
    let finish!: (value: Blob) => void
    let started!: () => void
    const packing = new Promise<void>((resolve) => {
      started = resolve
    })
    vi.mocked(createScoreNoticePdf).mockImplementation(() => {
      started()
      return new Promise<Blob>((resolve) => {
        finish = resolve
      })
    })
    const scope = effectScope()
    const output = scope.run(() =>
      useTeachingExport(
        () => 'owner',
        () => 'current',
        ref({ getElement: () => document.createElement('div') })
      )
    )!
    const pending = output.run('pdf', ['one'])
    await packing
    scope.stop()
    finish(new Blob(['pdf']))
    await pending
    expect(downloadBlob).not.toHaveBeenCalled()
    expect(output.context.value).toBeNull()
  })
})
