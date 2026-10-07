import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { captureDownloadGuard, downloadBlob } from '@/utils/downloadUtil'
import { apiRequest } from '@/api/client'
import { clearServerState, serverState } from '@/repositories/v5StateRepository'
vi.mock('@/api/client', () => ({ apiRequest: vi.fn() }))
beforeEach(() => {
  vi.stubEnv('VITE_STORAGE_MODE', 'server')
  clearServerState()
  Object.assign(serverState, { ownerId: 'teacher', workspaceId: 'period', loading: false })
  vi.mocked(apiRequest).mockImplementation(async (path) =>
    path === '/me/context' ? { id: 'teacher', role: 'USER' } : { fingerprint: 'same' }
  )
})
afterEach(() => {
  clearServerState()
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})
it('生成后跨设备成绩改变，旧快照不得下载', async () => {
  const guard = await captureDownloadGuard()
  vi.mocked(apiRequest).mockImplementation(async (path) =>
    path === '/me/context' ? { id: 'teacher', role: 'USER' } : { fingerprint: 'changed' }
  )
  await expect(guard()).rejects.toThrow('数据已变化')
})
it('生成后切换账号拒绝旧结果，稳定身份和快照可通过', async () => {
  const guard = await captureDownloadGuard()
  await expect(guard()).resolves.toBeUndefined()
  serverState.ownerId = 'other'
  await expect(guard()).rejects.toThrow('账号或班级已切换')
})
it('管理员本人不能通过浏览器工具下载教学文件', async () => {
  const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined)
  vi.mocked(apiRequest).mockResolvedValue({ id: 'admin', role: 'ADMIN' })
  await expect(downloadBlob(new Blob(['test']), '教学.xlsx')).rejects.toThrow('不能导出教学数据')
  expect(click).not.toHaveBeenCalled()
})
