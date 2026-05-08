import type {
  NameListCompareEntryType,
  NameListCompareResultType,
  NameListCompareRowType
} from '@/types/NameListCompare'

export function normalizeName(value: unknown): string {
  if (typeof value !== 'string' && typeof value !== 'number') return ''
  return String(value).trim()
}

export function findSuggestedNameColumn(headers: string[]): string {
  if (headers.includes('姓名')) return '姓名'

  const matchedHeader = headers.find((header) => header.includes('姓名'))
  if (matchedHeader) return matchedHeader

  return headers[0] || ''
}

export function parsePastedRows(text: string): { headers: string[]; rows: NameListCompareRowType[] } {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.replace(/\r/g, ''))
    .filter((line) => line.trim().length > 0)

  if (lines.length === 0) {
    return {
      headers: [],
      rows: []
    }
  }

  const hasTableShape = lines.some((line) => line.includes('\t'))

  if (!hasTableShape) {
    return {
      headers: ['姓名'],
      rows: lines.map((line) => ({ 姓名: line }))
    }
  }

  const cells = lines.map((line) => line.split('\t'))
  const rawHeaders = cells[0]
  const headers = rawHeaders.map((header, index) => {
    const value = header.trim()
    return value || `列${index + 1}`
  })
  const rows = cells.slice(1).map((row) => {
    const result: NameListCompareRowType = {}
    headers.forEach((header, index) => {
      result[header] = row[index] ?? ''
    })
    return result
  })

  return { headers, rows }
}

export function buildNameEntries(
  rows: NameListCompareRowType[],
  nameColumn: string
): NameListCompareEntryType[] {
  return rows
    .map((row, index) => {
      const name = normalizeName(row[nameColumn])
      return {
        name,
        normalizedName: name,
        originalIndex: index
      }
    })
    .filter((entry) => entry.name.length > 0)
}

export function buildNameListCompareResult(options: {
  baselineEntries: NameListCompareEntryType[]
  comparisonEntries: NameListCompareEntryType[]
}): NameListCompareResultType {
  const { baselineEntries, comparisonEntries } = options
  const comparisonBuckets = new Map<string, number[]>()
  const usedComparisonIndexes = new Set<number>()
  const rows: NameListCompareResultType['rows'] = []
  const groups: NameListCompareResultType['groups'] = {
    baselineOnly: [],
    comparisonOnly: [],
    matched: []
  }

  comparisonEntries.forEach((entry, index) => {
    const bucket = comparisonBuckets.get(entry.normalizedName) || []
    bucket.push(index)
    comparisonBuckets.set(entry.normalizedName, bucket)
  })

  baselineEntries.forEach((entry) => {
    const bucket = comparisonBuckets.get(entry.normalizedName) || []
    const comparisonIndex = bucket.shift()

    if (comparisonIndex === undefined) {
      rows.push({
        baselineName: entry.name,
        comparisonName: '',
        matched: false
      })
      groups.baselineOnly.push(entry.name)
      return
    }

    usedComparisonIndexes.add(comparisonIndex)
    rows.push({
      baselineName: entry.name,
      comparisonName: comparisonEntries[comparisonIndex].name,
      matched: true
    })
    groups.matched.push(entry.name)
  })

  comparisonEntries.forEach((entry, index) => {
    if (usedComparisonIndexes.has(index)) return

    rows.push({
      baselineName: '',
      comparisonName: entry.name,
      matched: false
    })
    groups.comparisonOnly.push(entry.name)
  })

  return {
    rows,
    summary: {
      baselineCount: baselineEntries.length,
      comparisonCount: comparisonEntries.length,
      matchedCount: groups.matched.length,
      baselineOnlyCount: groups.baselineOnly.length,
      comparisonOnlyCount: groups.comparisonOnly.length
    },
    groups
  }
}
