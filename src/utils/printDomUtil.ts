/** 等待字体、图片解码与两帧布局完成；节点必须以原尺寸挂载，不能 display:none。 */
export async function waitForPrintReady(element: HTMLElement): Promise<void> {
  element.getBoundingClientRect()
  await document.fonts?.ready
  await Promise.all(
    Array.from(element.querySelectorAll<HTMLElement>('[data-print-chart-ready="false"]')).map(
      (chart) =>
        new Promise<void>((resolve, reject) => {
          const finish = (): void => {
            clearTimeout(timer)
            chart.removeEventListener('print-chart-ready', finish)
            resolve()
          }
          const timer = setTimeout(() => {
            chart.removeEventListener('print-chart-ready', finish)
            reject(new Error('图表尚未完成渲染，请重试'))
          }, 10000)
          chart.addEventListener('print-chart-ready', finish, { once: true })
          if (chart.dataset.printChartReady === 'true') finish()
        })
    )
  )
  await Promise.all(
    Array.from(element.querySelectorAll('img')).map(async (image) => {
      if (!image.getAttribute('src')) return
      await image.decode()
    })
  )
  await new Promise<void>((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
  )
  if (!element.isConnected || !element.offsetWidth || !element.offsetHeight)
    throw new Error('纸张尚未完成布局')
}

/** 深拷贝打印数据，避免导出期间引用工作台的响应式对象。 */
export function freezePrintData<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}
