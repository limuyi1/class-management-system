/**
 * dutyRosterExportUtil 测试
 * 覆盖值日表导出工具：文件名清洗（sanitizeDutyRosterFileName）与导出日期格式化（formatDutyRosterExportDate）。
 */

import { describe, expect, it } from 'vitest'

import {
  formatDutyRosterExportDate,
  sanitizeDutyRosterFileName
} from '@/utils/duty-roster/dutyRosterExportUtil'

// 值日表导出：文件名非法字符清洗与导出日期格式化
describe('dutyRosterExportUtil', () => {
  it('sanitizes file names and formats export dates', () => {
    expect(sanitizeDutyRosterFileName('303班/值日表:*')).toBe('303班_值日表__')
    expect(formatDutyRosterExportDate(new Date(2026, 6, 16))).toBe('2026-07-16')
  })
})
