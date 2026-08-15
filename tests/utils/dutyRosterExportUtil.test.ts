import { describe, expect, it } from 'vitest'

import {
  formatDutyRosterExportDate,
  sanitizeDutyRosterFileName
} from '@/utils/duty-roster/dutyRosterExportUtil'

describe('dutyRosterExportUtil', () => {
  it('sanitizes file names and formats export dates', () => {
    expect(sanitizeDutyRosterFileName('303班/值日表:*')).toBe('303班_值日表__')
    expect(formatDutyRosterExportDate(new Date(2026, 6, 16))).toBe('2026-07-16')
  })
})
