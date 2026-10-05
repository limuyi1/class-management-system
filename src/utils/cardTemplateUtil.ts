import { PDFDocument, rgb } from 'pdf-lib'

import { applyNoticeCardPreset } from './print-template/cardPresetUtil'
import { renderSceneTemplate } from './print-template/renderSceneTemplateUtil'

import { CardLayerKindEnum } from '@/types/PrintTools'

import type { CardLayerType, CardTemplateType, PrintCanvasPageType } from '@/types/PrintTools'
import type { ZipEntryType } from '@/utils/zipUtil'

/** 创建可编辑的文字或图片层。 */
export function createCardLayer(kind: CardLayerKindEnum, text = '新文字'): CardLayerType {
  return {
    id: crypto.randomUUID(),
    kind,
    label: kind === CardLayerKindEnum.Text ? text : '装饰素材',
    x: 20,
    y: 20,
    width: 100,
    height: 20,
    text,
    image: '',
    fontSize: 22,
    color: '#333333',
    align: 'center',
    bold: false,
    hidden: false,
    locked: false
  }
}

/** 内置模板只保存布局和变量，不写入实际学生资料。 */
export function createCardTemplate(
  preset: 'certificate' | 'card' | 'blank' = 'certificate'
): CardTemplateType {
  const small = preset === 'card'
  const width = small ? 148 : 297
  const height = small ? 105 : 210
  const factor = small ? 0.5 : 1
  const texts = [
    {
      text: small ? '表扬卡' : '奖 状',
      x: 20,
      y: 24,
      width: 257,
      height: 30,
      fontSize: 56,
      color: '#a52c29',
      bold: true
    },
    {
      text: '{{姓名}} 同学：',
      x: 42,
      y: 66,
      width: 213,
      height: 20,
      fontSize: 26,
      color: '#222222',
      bold: true
    },
    {
      text: '荣获「{{称号}}」',
      x: 28,
      y: 92,
      width: 241,
      height: 23,
      fontSize: 34,
      color: '#a52c29',
      bold: true
    },
    {
      text: '{{正文}}',
      x: 46,
      y: 120,
      width: 205,
      height: 36,
      fontSize: 22,
      color: '#333333',
      bold: false
    },
    {
      text: '{{学校}}\n{{班级}} {{落款}}\n{{日期}}',
      x: 160,
      y: 165,
      width: 91,
      height: 32,
      fontSize: 17,
      color: '#555555',
      bold: false
    }
  ]
  const template: CardTemplateType = {
    id: crypto.randomUUID(),
    name: preset === 'blank' ? '素材模板' : small ? '简洁表扬卡' : '简洁奖状',
    width,
    height,
    background: '',
    backgroundFit: 'contain',
    layers:
      preset === 'blank'
        ? []
        : texts.map((item) => ({
            ...createCardLayer(CardLayerKindEnum.Text, item.text),
            ...item,
            x: item.x * factor,
            y: item.y * factor,
            width: item.width * factor,
            height: item.height * factor,
            fontSize: item.fontSize * factor
          }))
  }
  if (preset !== 'blank') {
    template.layers[1].align = 'left'
    template.layers[3].align = 'left'
    template.layers[4].align = 'right'
    template.layers[4].textFormat = 'award-signature'
  }
  return preset === 'blank' ? template : applyNoticeCardPreset(template)
}

export { resolveCardText, wrapCardText } from './print-template/cardTextUtil'

/** 渲染真实尺寸卡片并报告溢出，预览和导出共享同一排版。 */
export async function renderCardTemplate(
  template: CardTemplateType,
  fields: Record<string, string>,
  pixelRatio = 1
): Promise<{ page: PrintCanvasPageType; warnings: string[] }> {
  return renderSceneTemplate(template, fields, pixelRatio)
}

/** 按模板原尺寸或 A4 四联拼版导出，图片等比缩放并绘制裁切边框。 */
export async function createCardPdf(
  entries: ZipEntryType[],
  template: Pick<CardTemplateType, 'width' | 'height'>,
  fourUp: boolean
): Promise<Blob> {
  if (!entries.length) throw new Error('没有可导出的卡片')
  const pdf = await PDFDocument.create()
  const mm = 72 / 25.4
  const pageWidth = fourUp ? (template.width > template.height ? 297 : 210) : template.width
  const pageHeight = fourUp ? (template.width > template.height ? 210 : 297) : template.height
  for (let index = 0; index < entries.length; index += fourUp ? 4 : 1) {
    const page = pdf.addPage([pageWidth * mm, pageHeight * mm])
    for (let offset = 0; offset < (fourUp ? 4 : 1) && index + offset < entries.length; offset++) {
      const data = entries[index + offset].data
      const image = await pdf.embedPng(data instanceof Blob ? await data.arrayBuffer() : data)
      const cellWidth = fourUp ? (pageWidth - 24) / 2 : pageWidth
      const cellHeight = fourUp ? (pageHeight - 24) / 2 : pageHeight
      const scale = Math.min(cellWidth / template.width, cellHeight / template.height)
      const width = template.width * scale
      const height = template.height * scale
      const x = (fourUp ? 10 + (offset % 2) * (cellWidth + 4) : 0) + (cellWidth - width) / 2
      const top =
        (fourUp ? 10 + Math.floor(offset / 2) * (cellHeight + 4) : 0) + (cellHeight - height) / 2
      const y = pageHeight - top - height
      page.drawImage(image, { x: x * mm, y: y * mm, width: width * mm, height: height * mm })
      if (fourUp)
        page.drawRectangle({
          x: x * mm,
          y: y * mm,
          width: width * mm,
          height: height * mm,
          borderWidth: 0.4,
          borderColor: rgb(0.55, 0.55, 0.55),
          borderDashArray: [3, 3]
        })
    }
  }
  return new Blob([new Uint8Array(await pdf.save())], { type: 'application/pdf' })
}
