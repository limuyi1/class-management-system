import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

import { useOverviewAnalysisStore } from '../../src/stores/overview-analysis'

/**
 * useOverviewAnalysisStore store 测试
 * 测试目标：概览学情分析 store
 * 覆盖功能：分析文本与生成时间的写入/清空、初始状态
 */
describe('useOverviewAnalysisStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('initializes with empty analysis state', () => {
    const store = useOverviewAnalysisStore()

    expect(store.analysisText).toBe('')
    expect(store.generatedAt).toBe('')
  })

  it('records an ISO timestamp when setting analysis', () => {
    const store = useOverviewAnalysisStore()

    store.setAnalysis('本班整体表现良好')

    expect(store.analysisText).toBe('本班整体表现良好')
    expect(store.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
    expect(new Date(store.generatedAt).toString()).not.toBe('Invalid Date')
  })

  it('overwrites previous analysis text and refreshes timestamp', () => {
    vi.useFakeTimers()
    const store = useOverviewAnalysisStore()
    vi.setSystemTime(new Date('2026-09-07T08:00:00'))
    store.setAnalysis('第一次分析')
    const firstGeneratedAt = store.generatedAt

    vi.setSystemTime(new Date('2026-09-08T09:30:00Z'))
    store.setAnalysis('第二次分析')

    expect(store.analysisText).toBe('第二次分析')
    expect(store.generatedAt).toBe('2026-09-08T09:30:00.000Z')
    expect(store.generatedAt).not.toBe(firstGeneratedAt)
  })

  it('clears both text and timestamp', () => {
    const store = useOverviewAnalysisStore()
    store.setAnalysis('待清空的分析')

    store.clearAnalysis()

    expect(store.analysisText).toBe('')
    expect(store.generatedAt).toBe('')
  })
})
