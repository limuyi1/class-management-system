/** AI JSON 响应解析与失败回退。 */
import { parseJsonArray, parseJsonObject } from '@/ai/responseParser'

/** 解析 JSON 对象，失败时返回兜底值并记录错误 */
export function parseObjectWithFallback<T>(responseText: string, fallback: T, scene: string): T {
  const parsed = parseJsonObject<T>(responseText)
  if (parsed) return parsed
  console.error(`[AI] ${scene}: failed to parse object from response`, responseText)
  return fallback
}

/** 解析 JSON 数组，失败时返回兜底值并记录错误 */
export function parseArrayWithFallback<T>(responseText: string, fallback: T[], scene: string): T[] {
  const parsed = parseJsonArray<T>(responseText)
  if (parsed) return parsed
  console.error(`[AI] ${scene}: failed to parse array from response`, responseText)
  return fallback
}
