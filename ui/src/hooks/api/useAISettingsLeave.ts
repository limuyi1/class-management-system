import { onScopeDispose } from 'vue'
import { ElMessageBox } from 'element-plus'

/** 配置密钥和额度期间阻止离开；未保存表单在导航、退出和关闭页面时给出提示。 */
export function useAISettingsLeave(
  busy: () => boolean,
  dirty: () => boolean,
  discard: () => void = () => {}
) {
  async function canLeave(): Promise<boolean> {
    if (busy()) return false
    if (!dirty()) return true
    try {
      await ElMessageBox.confirm('AI 设置尚未保存，确定离开并放弃修改吗？', '未保存设置', {
        type: 'warning',
        confirmButtonText: '放弃并离开',
        cancelButtonText: '继续编辑'
      })
      discard()
      return true
    } catch {
      return false
    }
  }
  const beforeUnload = (event: BeforeUnloadEvent): void => {
    if (busy() || dirty()) {
      event.preventDefault()
      event.returnValue = ''
    }
  }
  window.addEventListener('beforeunload', beforeUnload)
  onScopeDispose(() => window.removeEventListener('beforeunload', beforeUnload))
  return { canLeave }
}
