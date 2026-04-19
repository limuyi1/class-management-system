import domtoimage from 'dom-to-image'
import { jsPDF } from 'jspdf'

import { PagesEnum } from '@/types/Common'

/**
 * PDF 导出工具
 * 将 DOM 元素转换为 PDF 文件
 */

interface ExportPDFResultType {
  success: boolean
  error?: Error
}

/**
 * 将 DOM 元素导出为 PDF 文件
 * @param refs DOM 元素集合（类数组对象），每个元素将作为 PDF 一页
 * @param pageType PDF 页面尺寸类型，默认 A4
 * @param scale 导出缩放比例，默认 4（提高清晰度）
 * @param fileName 导出文件名，默认为当前日期时间
 */
const exportPDF = async (
  refs: ArrayLike<Element>,
  pageType: PagesEnum = PagesEnum.A4,
  scale: number = 4,
  fileName: string = new Date().toLocaleString() + '.pdf'
): Promise<ExportPDFResultType> => {
  try {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'px',
      format: pageType
    })

    const elements = Array.from(refs).filter((ref): ref is HTMLElement => ref instanceof HTMLElement)
    for (const [index, elm] of elements.entries()) {

      const imageUrl = await domtoimage.toJpeg(elm, {
        quality: 0.8,
        width: elm?.offsetWidth * scale,
        height: elm?.offsetHeight * scale,
        bgcolor: '#FFFFFF',
        style: {
          transform: `scale(${scale})`, // 放大元素倍数，提高清晰度
          transformOrigin: '0 0' // 指定变换的原点
        }
      })
      const imgData = new Image()
      imgData.src = imageUrl

      const imgProps = doc.getImageProperties(imgData)
      const pdfWidth = doc.internal.pageSize.getWidth()
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width
      doc.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight)

      if (index !== elements.length - 1) {
        doc.addPage()
      }
    }

    doc.save(fileName)
    return { success: true }
  } catch (err) {
    const error = err instanceof Error ? err : new Error('导出失败')
    console.error(error)
    return { success: false, error }
  }
}

export { exportPDF }
