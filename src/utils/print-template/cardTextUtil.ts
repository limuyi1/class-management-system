import type { CardLayerType } from '@/types/PrintTools'

/** 只替换明确的变量标记，保留缺失变量以提示用户补充。 */
export function resolveCardText(template: string, fields: Record<string, string>): string {
  return template.replace(/\{\{\s*([^{}]+?)\s*\}\}/g, (token, key: string) =>
    Object.prototype.hasOwnProperty.call(fields, key.trim()) ? fields[key.trim()] : token
  )
}

/** 按实际字体测量换行，显式换行和空行保持原样。 */
export function wrapCardText(
  value: string,
  width: number,
  measure: (text: string) => number
): string[] {
  return value.split('\n').flatMap((paragraph) => {
    const lines: string[] = []
    let line = ''
    for (const character of Array.from(paragraph)) {
      if (line && measure(line + character) > width) {
        lines.push(line)
        line = ''
      }
      line += character
    }
    lines.push(line)
    return lines
  })
}

/** 奖状落款使用紧凑的署名行和中文日期，空字段不留下空行。 */
export function resolveCardLayerText(layer: CardLayerType, fields: Record<string, string>): string {
  if (layer.textFormat !== 'award-signature') return resolveCardText(layer.text, fields)
  const date = fields.日期?.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/)
  const values = date
    ? { ...fields, 日期: `${date[1]}年${Number(date[2])}月${Number(date[3])}日` }
    : fields
  return resolveCardText(layer.text, values)
    .split('\n')
    .map((line) => line.trim().replace(/[ \t]+/g, '　'))
    .filter(Boolean)
    .join('\n')
}
