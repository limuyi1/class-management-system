import { describe, expect, it } from 'vitest'
import { PDFDocument } from 'pdf-lib'

import { createScoreNoticePdf } from '../../src/utils/score-notice/scoreNoticePdfUtil'

/** 验证合并通知逐人分页，避免多个学生挤在同一张打印纸上。 */
describe('通知 PDF 导出', () => {
  it('没有通知时拒绝生成空文档', async () => {
    await expect(createScoreNoticePdf([])).rejects.toThrow('没有可导出的通知')
  })
  it('同名学生也保留独立的 A4 横向页面', async () => {
    const png = new Uint8Array(
      Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aS1cAAAAASUVORK5CYII=',
        'base64'
      )
    )
    const result = await createScoreNoticePdf([
      { name: '1-李明.png', data: png },
      { name: '2-李明.png', data: png }
    ])
    const pdf = await PDFDocument.load(await result.arrayBuffer())
    expect(pdf.getPageCount()).toBe(2)
    for (const page of pdf.getPages()) {
      expect(page.getWidth()).toBeCloseTo(841.89)
      expect(page.getHeight()).toBeCloseTo(595.28)
    }
  })
})
