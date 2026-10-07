import { effectScope } from 'vue'
import { afterEach, expect, it, vi } from 'vitest'
import { useApiPrintExport } from '@/hooks/api/useApiPrintExport'
import { readTeachingSnapshot } from '@/api/teaching'
import { createCardPdf } from '@/utils/cardTemplateUtil'
import { downloadBlob } from '@/utils/downloadUtil'
vi.mock('@/api/teaching', () => ({ readTeachingSnapshot: vi.fn() }))
vi.mock('@/utils/cardTemplateUtil', () => ({
  createCardPdf: vi.fn().mockResolvedValue(new Blob(['pdf']))
}))
vi.mock('@/utils/downloadUtil', () => ({
  downloadBlob: vi.fn(),
  sanitizeExportFileName: (name: string) => name
}))
afterEach(() => vi.clearAllMocks())
it('完成渲染后再次鉴权，撤权时不下载已有图片', async () => {
  const scope = effectScope(),
    state = scope.run(() =>
      useApiPrintExport(
        () => 'owner',
        () => 'period'
      )
    )!
  vi.mocked(readTeachingSnapshot).mockRejectedValueOnce(new Error('已撤权'))
  await expect(
    state.run([async () => new Blob(['png'])], '名单', { width: 210, height: 297 })
  ).rejects.toThrow('已撤权')
  expect(createCardPdf).toHaveBeenCalledOnce()
  expect(downloadBlob).not.toHaveBeenCalled()
  expect(state.busy.value).toBe(false)
  scope.stop()
})
it('旧账号图片生成晚响应不下载，组件销毁也释放任务', async () => {
  let owner = 'first',
    resolve: (value: Blob) => void = () => {}
  const scope = effectScope(),
    state = scope.run(() =>
      useApiPrintExport(
        () => owner,
        () => 'period'
      )
    )!
  const job = state.run(
    [
      () =>
        new Promise<Blob>((done) => {
          resolve = done
        })
    ],
    '名单',
    { width: 210, height: 297 }
  )
  owner = 'second'
  resolve(new Blob(['png']))
  await job
  expect(downloadBlob).not.toHaveBeenCalled()
  scope.stop()
})
