import { createVNode, nextTick, render } from 'vue'

import { renderDomPngBlob } from './domImageUtil'
import { waitForPrintReady } from './printDomUtil'

import type { Component } from 'vue'

/** 以相同 Vue 组件挂载原尺寸副本，逐页导出后立即释放，不受预览缩放影响。 */
export async function renderPrintPaperBlob(
  component: Component,
  props: Record<string, unknown>
): Promise<Blob> {
  const host = document.createElement('div')
  host.style.cssText = 'position:fixed;left:-20000px;top:0;pointer-events:none;width:max-content'
  document.body.appendChild(host)
  try {
    render(createVNode(component, props), host)
    await nextTick()
    const paper = host.querySelector<HTMLElement>('[data-print-paper]')
    if (!paper) throw new Error('未找到导出纸张')
    await waitForPrintReady(paper)
    if (paper.dataset.printWarning) throw new Error(paper.dataset.printWarning)
    return await renderDomPngBlob(paper, 1, '#ffffff', '打印稿')
  } finally {
    render(null, host)
    host.remove()
  }
}
