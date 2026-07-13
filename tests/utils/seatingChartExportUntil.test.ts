import { describe, expect, it } from 'vitest'

import {
  formatSeatingChartExportDate,
  sanitizeSeatingChartFileName
} from '@/utils/seatingChartExportUntil'

describe('seatingChartExportUntil', () => {
  it('sanitizes file names and keeps a stable fallback', () => {
    expect(sanitizeSeatingChartFileName('一班/座位表:*?')).toBe('一班_座位表___')
    expect(sanitizeSeatingChartFileName('   ')).toBe('座位表')
  })

  it('formats the local export date', () => {
    expect(formatSeatingChartExportDate(new Date(2026, 6, 13))).toBe('2026-07-13')
  })
})
