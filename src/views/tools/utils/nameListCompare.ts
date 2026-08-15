import type {
  NameListCompareEntryType,
  NameListCompareResultType,
  NameListCompareRowType
} from '@/types/NameListCompare'

/**
 * 归一化姓名：仅接受字符串/数字，去除首尾空白。
 *
 * @param value 原始单元格值
 * @returns 归一化后的姓名
 */
export function normalizeName(value: unknown): string {
  if (typeof value !== 'string' && typeof value !== 'number') return ''
  return String(value).trim()
}

/**
 * 在表头中查找最可能为“姓名”的列。
 * 优先精确匹配，其次包含匹配，最后回退到第一列。
 *
 * @param headers 表头列表
 * @returns 建议的姓名列名
 */
export function findSuggestedNameColumn(headers: string[]): string {
  if (headers.includes('姓名')) return '姓名'

  const matchedHeader = headers.find((header) => header.includes('姓名'))
  if (matchedHeader) return matchedHeader

  return headers[0] || ''
}

/**
 * 解析粘贴的表格文本。
 * 带制表符时按表格结构解析表头与行；否则视作纯姓名列表。
 *
 * @param text 粘贴的原始文本
 * @returns 解析出的表头与行数据
 */
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
  // 空表头用“列N”占位，保证后续能按列名取值
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

/**
 * 将表格行转换为名单条目，过滤空姓名。
 *
 * @param rows 表格行
 * @param nameColumn 姓名列名
 * @returns 名单条目列表
 */
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

/**
 * 对比基准名单与对照名单，生成逐行结果与分组汇总。
 * 同名条目按出现顺序两两匹配，多余条目归入各自独有分组。
 *
 * @param options 基准与对照名单条目
 * @returns 对比结果
 */
export function buildNameListCompareResult(options: {
  baselineEntries: NameListCompareEntryType[]
  comparisonEntries: NameListCompareEntryType[]
}): NameListCompareResultType {
  const { baselineEntries, comparisonEntries } = options
  // 以归一化姓名为键分桶，支持同名多人按顺序匹配
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
    // 依次从同名桶中取出一个对照项，取不到则归入基准独有
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

  // 未被消费的对照项即为对照独有
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
