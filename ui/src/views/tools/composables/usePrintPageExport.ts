import { onBeforeUnmount, ref } from 'vue'

import { ElMessage } from 'element-plus'

import { onBeforeRouteLeave } from 'vue-router'

import { useWorkspaceTaskLock } from '@/hooks/useWorkspaceTaskLock'
import { createCardPdf } from '@/utils/cardTemplateUtil'
import { downloadBlob, sanitizeExportFileName } from '@/utils/downloadUtil'

import type { ZipEntryType } from '@/utils/zipUtil'

/** 页级任务冻结由调用方提供，停止后仍下载已成功完成的页面。 */
export function usePrintPageExport() {
  const busy = ref(false)
  const stopped = ref(false)
  const progress = ref(0)
  const total = ref(0)
  const errors = ref<string[]>([])
  useWorkspaceTaskLock(busy, '打印稿正在导出，请等待完成或停止任务')
  onBeforeRouteLeave(() => {
    if (!busy.value) return true
    ElMessage.warning('请先停止导出并等待已完成页面下载')
    return false
  })
  onBeforeUnmount(() => {
    stopped.value = true
  })
  async function exportPages(
    jobs: Array<() => Promise<Blob>>,
    title: string,
    size: { width: number; height: number }
  ): Promise<void> {
    if (busy.value || !jobs.length) return
    busy.value = true
    stopped.value = false
    progress.value = 0
    total.value = jobs.length
    errors.value = []
    const entries: ZipEntryType[] = []
    try {
      for (const [index, job] of jobs.entries()) {
        if (stopped.value) break
        try {
          entries.push({ name: `${index + 1}.png`, data: await job() })
        } catch (error) {
          console.error(error)
          errors.value.push(
            `第 ${index + 1} 页：${error instanceof Error ? error.message : '导出失败'}`
          )
        }
        progress.value++
      }
      if (entries.length) {
        await downloadBlob(
          await createCardPdf(entries, size, false),
          `${sanitizeExportFileName(title, '打印稿')}${stopped.value || errors.value.length ? '-已完成部分' : ''}.pdf`
        )
        ElMessage.success(
          `已导出 ${entries.length} 页${stopped.value || errors.value.length ? '（已完成部分）' : ''}`
        )
      } else ElMessage.error('没有可导出的页面，请检查溢出提示')
    } catch (error) {
      console.error(error)
      ElMessage.error('PDF 生成失败，请重试')
    } finally {
      busy.value = false
    }
  }
  return { busy, stopped, progress, total, errors, exportPages }
}
