import domtoimage from 'dom-to-image'
import { jsPDF } from 'jspdf'
import { ElMessage, ElLoading } from 'element-plus'

import { PagesEnum } from '@/types/Common'

/**
 * PDF 导出工具
 * 将 DOM 元素转换为 PDF 文件
 */

/**
 * 将 DOM 元素导出为 PDF 文件
 * @param refs DOM 元素集合（类数组对象），每个元素将作为 PDF 一页
 * @param pageType PDF 页面尺寸类型，默认 A4
 * @param scale 导出缩放比例，默认 4（提高清晰度）
 * @param fileName 导出文件名，默认为当前日期时间
 */
const exportPDF = async (
  refs: any,
  pageType: PagesEnum = PagesEnum.A4,
  scale: number = 4,
  fileName: string = new Date().toLocaleString() + '.pdf'
) => {
  const loading = ElLoading.service({
    lock: true,
    text: '正在导出PDF...',
    background: 'rgba(0, 0, 0, 0.7)'
  })

  try {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'px',
      format: pageType
      // compress: true, // 压缩文档
      // precision: 16 // 浮点数的精度
    })

    for (const [index, ref] of Array.from(refs).entries()) {
      const elm: HTMLElement = ref as HTMLElement

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

      if (index !== refs.length - 1) {
        doc.addPage()
      }
    }

    doc.save(fileName)

    loading.close()
  } catch (err) {
    console.error(err)

    ElMessage.error('导出失败！')
    loading.close()
  }
}

export { exportPDF }
