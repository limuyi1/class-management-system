import paper from '@/assets/score-notice/report-paper-background.png'
import corner from '@/assets/score-notice/report-corner-ornament-2x.png'
import watermark from '@/assets/score-notice/paper-floral-watermark-2x.png'

import type { CardLayerType, CardTemplateType } from '@/types/PrintTools'

/** 沿用现有通知的真实素材和配色，公共文案仍是可放大的 DOM 文字。 */
export function applyNoticeCardPreset(template: CardTemplateType): CardTemplateType {
  template.name = template.width < 200 ? '典雅表扬卡' : '典雅奖状'
  template.background = paper
  template.backgroundFit = 'cover'
  const small = template.width < 200
  template.frame = { corner, watermark, color: small ? '#154c46' : '#922f29' }
  template.layers.forEach((layer: CardLayerType, index: number) => {
    layer.fontFamily = 'STSong, "Songti SC", SimSun, "Noto Serif CJK SC", serif'
    layer.color =
      index === 0 ? (small ? '#123f3a' : '#922f29') : index === 2 ? '#986a21' : '#43382b'
    layer.lineHeight = index === 3 ? 1.8 : index === 4 ? 1.65 : 1.25
    if (index === 0) {
      layer.text = '{{标题}}'
      layer.label = '标题'
      layer.letterSpacing = 8
    } else {
      layer.label = ['标题', '学生姓名', '表扬称号', '表扬正文', '颁发落款'][index]
    }
  })
  return template
}

/** 提取模板使用的变量，按首次出现顺序返回，隐藏图层不产生多余的填写项。 */
export function getCardTemplateFields(template: CardTemplateType): string[] {
  return [
    ...new Set(
      template.layers
        .filter((layer) => !layer.hidden && layer.kind === 'text')
        .flatMap((layer) =>
          Array.from(layer.text.matchAll(/\{\{\s*([^{}]+?)\s*\}\}/g), (match) => match[1].trim())
        )
    )
  ]
}

/** 可复用文案排除工作区字段及学生字段，避免跨班级套用过期姓名或日期。 */
export function getCardDefaultFields(
  template: CardTemplateType,
  globals: Record<string, string>
): Record<string, string> {
  return Object.fromEntries(
    getCardTemplateFields(template)
      .filter(
        (key) =>
          !['姓名', '班级', '学期', '日期'].includes(key) &&
          Object.prototype.hasOwnProperty.call(globals, key)
      )
      .map((key) => [key, globals[key]])
  )
}
