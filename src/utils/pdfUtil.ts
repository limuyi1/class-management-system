import domtoimage from 'dom-to-image'
import { PDFDocument } from 'pdf-lib'

import { PagesEnum } from '@/types/Common'
import { pageSizeInPixels } from '@/utils/pageSizeInPixelUtil'

/**
 * PDF 导出工具
 * 将 DOM 元素转换为 PDF 文件
 */

/** PDF 导出结果：success 标识是否成功，失败时携带 error */
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
 * @returns 操作结果，success 标识是否成功，失败时携带 error
 */
const exportPDF = async (
  refs: ArrayLike<Element>,
  pageType: PagesEnum = PagesEnum.A4,
  scale: number = 4,
  fileName: string = new Date().toLocaleString() + '.pdf'
): Promise<ExportPDFResultType> => {
  try {
    const pdfDoc = await PDFDocument.create()
    const { width: pageWidth, height: pageHeight } = pageSizeInPixels(pageType)

    const elements = Array.from(refs).filter(
      (ref): ref is HTMLElement => ref instanceof HTMLElement
    )
    for (const elm of elements) {
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
      const imageBytes = await fetch(imageUrl).then((response) => response.arrayBuffer())
      const embeddedImage = await pdfDoc.embedJpg(imageBytes)
      const imageScale = pageWidth / embeddedImage.width
      const imageWidth = pageWidth
      const imageHeight = embeddedImage.height * imageScale
      const page = pdfDoc.addPage([pageWidth, pageHeight])

      page.drawImage(embeddedImage, {
        x: 0,
        y: pageHeight - imageHeight,
        width: imageWidth,
        height: imageHeight
      })
    }

    const bytes = await pdfDoc.save()
    const blobBytes = new Uint8Array(bytes)
    const blob = new Blob([blobBytes], { type: 'application/pdf' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = fileName
    anchor.click()
    URL.revokeObjectURL(url)
    return { success: true }
  } catch (err) {
    const error = err instanceof Error ? err : new Error('导出失败')
    console.error(error)
    return { success: false, error }
  }
}

export { exportPDF }
