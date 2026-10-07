/** 所有纸张以自然尺寸提供节点，屏幕缩放不属于导出参数。 */
export interface PrintPaperExposeType {
  getElement: () => HTMLElement | undefined
  getSize: () => { width: number; height: number }
  ready: () => Promise<void>
}
