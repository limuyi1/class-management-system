/**
 * 测试 seatingChartExportUtil 模块。
 * 覆盖：导出文件名的非法字符清洗与空白回退、本地时区导出日期格式化。
 */
import { describe, expect, it } from 'vitest'

import {
  formatSeatingChartExportDate,
  sanitizeSeatingChartFileName
} from '@/utils/seating-chart/seatingChartExportUtil'

// 座位表导出工具函数测试组
describe('seatingChartExportUtil', () => {
  it('sanitizes file names and keeps a stable fallback', () => {
    expect(sanitizeSeatingChartFileName('一班/座位表:*?')).toBe('一班_座位表___')
    expect(sanitizeSeatingChartFileName('   ')).toBe('座位表')
  })

  it('formats the local export date', () => {
    expect(formatSeatingChartExportDate(new Date(2026, 6, 13))).toBe('2026-07-13')
  })
})
