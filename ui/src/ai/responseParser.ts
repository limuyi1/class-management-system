/**
 * 从文本中提取第一个 JSON 对象字符串
 * @param text - AI 返回的原始文本
 * @returns 匹配的 JSON 对象字符串，未找到返回 null
 */
export function extractJsonObjectText(text: string): string | null {
  const match = text.match(/\{[\s\S]*\}/)
  return match ? match[0] : null
}

/**
 * 从文本中提取第一个 JSON 数组字符串
 * @param text - AI 返回的原始文本
 * @returns 匹配的 JSON 数组字符串，未找到返回 null
 */
export function extractJsonArrayText(text: string): string | null {
  const match = text.match(/\[[\s\S]*\]/)
  return match ? match[0] : null
}

/**
 * 解析文本中的 JSON 对象
 * @param text - 包含 JSON 对象的文本
 * @returns 解析结果，解析失败返回 null
 */
export function parseJsonObject<T>(text: string): T | null {
  const objectText = extractJsonObjectText(text)
  if (!objectText) return null

  try {
    return JSON.parse(objectText) as T
  } catch {
    return null
  }
}

/**
 * 解析文本中的 JSON 数组
 * @param text - 包含 JSON 数组的文本
 * @returns 解析结果，解析失败返回 null
 */
export function parseJsonArray<T>(text: string): T[] | null {
  const arrayText = extractJsonArrayText(text)
  if (!arrayText) return null

  try {
    const parsed = JSON.parse(arrayText)
    return Array.isArray(parsed) ? (parsed as T[]) : null
  } catch {
    return null
  }
}
