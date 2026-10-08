import { describe, expect, it } from 'vitest'
import { sortWorkspacePeriods } from '@/utils/workspacePeriodSortUtil'
import type { WorkspacePeriodType } from '@/types/Workspace'

function period(termName: string, createdAt = '2026-01-01'): WorkspacePeriodType {
  return { id: termName, classId: 'class', className: '403班', termName, createdAt, references: [] }
}

describe('学期展示排序', () => {
  it('按实际学期倒序，补录旧学期不会被排到最前，也不修改原目录', () => {
    const periods = [
      period('2026-2027上学期', '2026-08-01'),
      period('2025-2026下学期', '2026-02-01'),
      period('2025-2026上学期', '2026-10-08'),
      period('2026-2027下学期', '2026-08-02')
    ]
    const original = periods.slice()
    expect(sortWorkspacePeriods(periods).map((item) => item.termName)).toEqual([
      '2026-2027下学期',
      '2026-2027上学期',
      '2025-2026下学期',
      '2025-2026上学期'
    ])
    expect(periods).toEqual(original)
  })
  it('兼容空格、不同连接符、全角数字和第一第二学期', () => {
    expect(
      sortWorkspacePeriods([
        period('2025–2026 第一学期'),
        period('２０２６—２０２７ 上学期'),
        period('2025/2026 第2学期')
      ]).map((item) => item.termName)
    ).toEqual(['２０２６—２０２７ 上学期', '2025/2026 第2学期', '2025–2026 第一学期'])
  })
  it('自定义名称按创建时间倒序，缺失创建时间也能稳定排列', () => {
    const older = period('旧学期', '2025-01-01')
    const newer = period('当前学期', '2026-01-01')
    const missing = period('迁移学期', '')
    expect(sortWorkspacePeriods([older, missing, newer])).toEqual([newer, older, missing])
  })
})
