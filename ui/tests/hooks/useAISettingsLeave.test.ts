import { effectScope } from 'vue'
import { afterEach, expect, it, vi } from 'vitest'
import { ElMessageBox } from 'element-plus'
import { useAISettingsLeave } from '@/hooks/api/useAISettingsLeave'
vi.mock('element-plus', () => ({ ElMessageBox: { confirm: vi.fn() } }))
afterEach(() => vi.clearAllMocks())
it('保存期间禁止离开，取消保留草稿，确认后才清除草稿', async () => {
  const scope = effectScope(),
    discard = vi.fn()
  let busy = true,
    dirty = true
  const guard = scope.run(() =>
    useAISettingsLeave(
      () => busy,
      () => dirty,
      discard
    )
  )!
  expect(await guard.canLeave()).toBe(false)
  expect(ElMessageBox.confirm).not.toHaveBeenCalled()
  busy = false
  vi.mocked(ElMessageBox.confirm).mockRejectedValueOnce('cancel')
  expect(await guard.canLeave()).toBe(false)
  expect(discard).not.toHaveBeenCalled()
  vi.mocked(ElMessageBox.confirm).mockResolvedValueOnce('confirm')
  expect(await guard.canLeave()).toBe(true)
  expect(discard).toHaveBeenCalledTimes(1)
  dirty = false
  expect(await guard.canLeave()).toBe(true)
  scope.stop()
})
it('有草稿时保护关闭页面，组件销毁后移除监听器', () => {
  const scope = effectScope()
  scope.run(() =>
    useAISettingsLeave(
      () => false,
      () => true
    )
  )
  const before = new Event('beforeunload', { cancelable: true })
  window.dispatchEvent(before)
  expect(before.defaultPrevented).toBe(true)
  scope.stop()
  const after = new Event('beforeunload', { cancelable: true })
  window.dispatchEvent(after)
  expect(after.defaultPrevented).toBe(false)
})
