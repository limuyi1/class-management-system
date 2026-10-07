import { onScopeDispose, ref } from 'vue'
import { readTeachingSnapshot } from '@/api/teaching'
import { createCardPdf } from '@/utils/cardTemplateUtil'
import { downloadBlob, sanitizeExportFileName } from '@/utils/downloadUtil'
import type { ZipEntryType } from '@/utils/zipUtil'
/** 浏览器只渲染受保护快照；生成后再次鉴权，停止时明确下载已完成部分。 */
export function useApiPrintExport(owner: () => string, workspace: () => string) {
  const busy = ref(false),
    stopped = ref(false),
    progress = ref(0),
    total = ref(0)
  let alive = true
  onScopeDispose(() => {
    alive = false
    stopped.value = true
  })
  async function run(
    jobs: (() => Promise<Blob>)[],
    title: string,
    size: { width: number; height: number }
  ): Promise<void> {
    if (busy.value || !jobs.length) return
    if (jobs.length > 50) throw new Error('每批最多导出 50 页，请缩小范围')
    const scope = owner(),
      id = workspace()
    busy.value = true
    stopped.value = false
    progress.value = 0
    total.value = jobs.length
    const entries: ZipEntryType[] = []
    try {
      for (const [index, job] of jobs.entries()) {
        if (!alive || stopped.value || scope !== owner() || id !== workspace()) break
        entries.push({ name: `${index + 1}.png`, data: await job() })
        progress.value++
        await new Promise<void>((resolve) => setTimeout(resolve, 0))
      }
      if (!entries.length || !alive || scope !== owner() || id !== workspace()) return
      const blob = await createCardPdf(entries, size, false)
      await readTeachingSnapshot(scope, id)
      if (!alive || scope !== owner() || id !== workspace()) return
      await downloadBlob(
        blob,
        `${sanitizeExportFileName(title, '打印稿')}${stopped.value ? '-已完成部分' : ''}.pdf`
      )
    } finally {
      busy.value = false
    }
  }
  return { busy, stopped, progress, total, run }
}
