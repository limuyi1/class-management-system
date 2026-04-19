export function extractJsonObjectText(text: string): string | null {
  const match = text.match(/\{[\s\S]*\}/)
  return match ? match[0] : null
}

export function extractJsonArrayText(text: string): string | null {
  const match = text.match(/\[[\s\S]*\]/)
  return match ? match[0] : null
}

export function parseJsonObject<T>(text: string): T | null {
  const objectText = extractJsonObjectText(text)
  if (!objectText) return null

  try {
    return JSON.parse(objectText) as T
  } catch {
    return null
  }
}

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
