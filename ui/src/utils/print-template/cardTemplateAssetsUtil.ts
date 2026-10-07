import { blobToDataUrl } from '@/utils/fileUtil'

import type { CardTemplateType } from '@/types/PrintTools'

/** 成品模板运行时复用静态素材缓存，保存时内嵌，避免版本更新后素材链接失效。 */
export async function embedCardTemplateAssets(template: CardTemplateType): Promise<void> {
  const cache = new Map<string, Promise<string>>()
  async function embed(source: string): Promise<string> {
    if (!source || source.startsWith('data:')) return source
    if (!cache.has(source))
      cache.set(
        source,
        (async () => {
          const response = await fetch(source)
          if (!response.ok) throw new Error('模板素材读取失败')
          const blob = await response.blob()
          if (!blob.type.startsWith('image/')) throw new Error('模板素材不是有效图片')
          return blobToDataUrl(blob)
        })()
      )
    return cache.get(source)!
  }
  template.background = await embed(template.background)
  if (template.frame) {
    template.frame.corner = await embed(template.frame.corner)
    template.frame.watermark = await embed(template.frame.watermark)
  }
}
