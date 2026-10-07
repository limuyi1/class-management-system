import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

import { useConfigurationStore } from '../../src/stores/configuration'

/**
 * useConfigurationStore store 测试
 * 测试目标：应用配置 store
 * 覆盖功能：24 个默认字段初始化、字体大小批量同步、页面类型列表顺序
 */
describe('useConfigurationStore', () => {
  // 每个用例前创建全新的 Pinia 实例，隔离 store 状态
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('initializes with default configuration values', () => {
    const store = useConfigurationStore()

    expect(store.fontSize).toBe(18)
    expect(store.salutationFontSize).toBe(18)
    expect(store.textFontSize).toBe(18)
    expect(store.sealFontSize).toBe(18)
    expect(store.classTeacherFontSize).toBe(18)
    expect(store.inscribeFontSize).toBe(18)
    expect(store.inscribe).toBe('')
    expect(store.showEvaluationPageNumber).toBe(true)
    expect(store.pageType).toBe('A4')
    expect(store.pageTypeList).toEqual(['A3', 'A4', 'B3', 'B4'])
    expect(store.evaluationCardWidth).toBe(90)
    expect(store.evaluationCardHeight).toBe(69)
    expect(store.marginX).toBe(15)
    expect(store.marginY).toBe(7.5)
    expect(store.evaluationTableAlign).toBe('left')
    expect(store.previewMode).toBe('100')
    expect(store.inputScoreTab).toBeNull()
    expect(store.recentScoreEntries).toEqual({})
    expect(store.scoreImageCompressRatio).toBe(0.6)
    expect(store.evaluationHandwriteFont).toBeNull()
    expect(store.lastBackupAt).toBeNull()
    expect(store.scoreFullMark).toBe(100)
    expect(store.menuCollapsed).toBe(false)
  })

  it('syncs the five font size fields without touching fontSize itself', () => {
    const store = useConfigurationStore()
    store.fontSizeChange(22)

    expect(store.salutationFontSize).toBe(22)
    expect(store.textFontSize).toBe(22)
    expect(store.sealFontSize).toBe(22)
    expect(store.classTeacherFontSize).toBe(22)
    expect(store.inscribeFontSize).toBe(22)
    // fontSize 本体不参与同步，其余字段保持默认
    expect(store.fontSize).toBe(18)
    expect(store.evaluationCardWidth).toBe(90)
  })

  it('keeps other fields unchanged after fontSizeChange', () => {
    const store = useConfigurationStore()
    store.inscribe = '班主任签名'
    store.fontSizeChange(16)

    expect(store.inscribe).toBe('班主任签名')
    expect(store.inscribeFontSize).toBe(16)
  })
})
