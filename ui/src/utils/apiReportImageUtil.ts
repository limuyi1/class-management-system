import { createVNode, nextTick, render } from 'vue'
import StudentReportPreviewCard from '@/components/student-report/StudentReportPreviewCard.vue'
import { renderDomPngBlob } from '@/utils/domImageUtil'
import { waitForPrintReady } from '@/utils/printDomUtil'
import type { StudentReportDataType } from '@/types/StudentReport'
/** 渲染冻结的服务器报告，关闭图表动画；完成或失败都释放临时 DOM。 */
export async function renderApiReportImage(
  report: StudentReportDataType,
  content: string
): Promise<Blob> {
  const host = document.createElement('div')
  host.style.cssText = 'position:fixed;left:-20000px;top:0;width:960px;pointer-events:none'
  document.body.appendChild(host)
  try {
    render(createVNode(StudentReportPreviewCard, { report, content, staticRendering: true }), host)
    await nextTick()
    const element = host.firstElementChild as HTMLElement
    await waitForPrintReady(element)
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
    )
    return await renderDomPngBlob(element, 1, '#ffffff', '学习报告')
  } finally {
    render(null, host)
    host.remove()
  }
}
