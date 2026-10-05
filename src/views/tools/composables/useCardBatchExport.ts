import { ref } from 'vue'

import { ElMessage } from 'element-plus'

import { useWorkspaceTaskLock } from '@/hooks/useWorkspaceTaskLock'
import { createCardPdf, renderCardTemplate } from '@/utils/cardTemplateUtil'
import { printCanvasBlob } from '@/utils/printCanvasUtil'
import { createStoredZip } from '@/utils/zipUtil'
import { downloadBlob, sanitizeExportFileName } from '@/utils/downloadUtil'

import type { Ref, ComputedRef } from 'vue'
import type { CardTemplateType, PrintStudentType } from '@/types/PrintTools'
import type { ZipEntryType } from '@/utils/zipUtil'

/** 管理卡片批量导出、停止、进度与逐人错误；名单和模板仅在开始时读取。 */
export function useCardBatchExport(
  template: Ref<CardTemplateType>,
  students: Ref<PrintStudentType[]>,
  currentStudent: ComputedRef<PrintStudentType | undefined>,
  globals: Ref<Record<string, string>>
) {
  const busy = ref(false)
  useWorkspaceTaskLock(busy, '奖状卡片正在导出，请先停止任务或等待完成')
  const cancelled = ref(false)
  const progress = ref(0)
  const total = ref(0)
  const errors = ref<string[]>([])
  const fourUp = ref(false)
  const exportingEntries = ref<ZipEntryType[]>([])

  /** 冻结名单和模板后逐张生成，错误逐人报告，允许下载成功部分。 */
  async function exportBatch(format: 'png' | 'zip' | 'pdf'): Promise<void> {
    if (busy.value) return
    const snapshot = JSON.parse(JSON.stringify(template.value)) as CardTemplateType
    const rows = JSON.parse(
      JSON.stringify(
        format === 'png' ? (currentStudent.value ? [currentStudent.value] : []) : students.value
      )
    ) as PrintStudentType[]
    if (!rows.length) return
    const values = { ...globals.value }
    const layout = fourUp.value
    busy.value = true
    cancelled.value = false
    progress.value = 0
    total.value = rows.length
    errors.value = []
    exportingEntries.value = []
    try {
      for (const [index, student] of rows.entries()) {
        if (cancelled.value) break
        try {
          const rendered = await renderCardTemplate(
            snapshot,
            {
              ...values,
              ...student.fields,
              姓名: student.name
            },
            snapshot.scene ? 2 : 1
          )
          if (rendered.warnings.length) throw new Error(rendered.warnings.join('；'))
          exportingEntries.value.push({
            name: sanitizeExportFileName(
              `${index + 1}-${student.name}.png`,
              `卡片${index + 1}.png`
            ),
            data: await printCanvasBlob(rendered.page.canvas)
          })
          rendered.page.canvas.width = 0
        } catch (error) {
          console.error(error)
          errors.value.push(
            `${student.name}：${error instanceof Error ? error.message : '生成失败'}`
          )
        }
        progress.value++
        await new Promise<void>((resolve) => setTimeout(resolve, 0))
      }
      if (!exportingEntries.value.length) return
      const name = sanitizeExportFileName(snapshot.name, '奖状卡片')
      if (format === 'png')
        downloadBlob(exportingEntries.value[0].data as Blob, exportingEntries.value[0].name)
      else if (format === 'zip')
        downloadBlob(await createStoredZip(exportingEntries.value), `${name}.zip`)
      else
        downloadBlob(await createCardPdf(exportingEntries.value, snapshot, layout), `${name}.pdf`)
      ElMessage.success(
        `已导出 ${exportingEntries.value.length} 张${cancelled.value ? '（已完成部分）' : ''}`
      )
    } catch (error) {
      console.error(error)
      ElMessage.error('导出失败，请重试')
    } finally {
      busy.value = false
      exportingEntries.value = []
    }
  }

  return { busy, cancelled, progress, total, errors, fourUp, exportBatch }
}
