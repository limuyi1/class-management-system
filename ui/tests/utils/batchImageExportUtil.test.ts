import { describe, expect, it } from 'vitest'
import { PDFDocument } from 'pdf-lib'

import { createBatchImagePdf, getReportPdfLayout } from '../../src/utils/batchImageExportUtil'

describe('学习报告 PDF 分页', () => {
  it('长报告按宽度缩放并自动续页，不继续缩小正文', () => {
    const standard = getReportPdfLayout(1120, 1000)
    const long = getReportPdfLayout(1120, 4000)
    expect(standard.pageCount).toBe(1)
    expect(long.pageCount).toBe(3)
    expect(long.scale).toBe(standard.scale)
    expect(long.pageCount * long.contentHeight).toBeGreaterThanOrEqual(4000 * long.scale)
  })
  it('两名学生分别从新 A4 页开始', async () => {
    const png = new Uint8Array(
      Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aS1cAAAAASUVORK5CYII=',
        'base64'
      )
    )
    const blob = await createBatchImagePdf([
      { name: '甲.png', data: png },
      { name: '乙.png', data: png }
    ])
    const pdf = await PDFDocument.load(await blob.arrayBuffer())
    expect(pdf.getPageCount()).toBe(2)
    expect(pdf.getPages()[0].getWidth()).toBeCloseTo(595.28)
    expect(pdf.getPages()[0].getHeight()).toBeCloseTo(841.89)
  })
})
