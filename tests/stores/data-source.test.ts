import { describe, expect, it, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useDataSourceStore } from '../../src/stores/data-source'
import { useConfigurationStore } from '../../src/stores/configuration'

describe('useDataSourceStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('should initialize with empty data', () => {
    const store = useDataSourceStore()
    expect(store.items).toEqual([])
  })

  it('should set data correctly', () => {
    const store = useDataSourceStore()
    const testData = [
      { xing4_ming2: '张三', yu3_wen2: 85 },
      { xing4_ming2: '李四', yu3_wen2: 90 }
    ]
    store.items = testData
    expect(store.items).toEqual(testData)
  })

  it('should filter disabled students in enabledData', () => {
    const store = useDataSourceStore()
    store.items = [
      { xing4_ming2: '张三', disabled: false },
      { xing4_ming2: '李四', disabled: true },
      { xing4_ming2: '王五', disabled: false }
    ]

    const enabled = store.enabledData
    expect(enabled).toHaveLength(2)
    expect(enabled.map((s: any) => s.xing4_ming2)).toEqual(['张三', '王五'])
  })

  it('should return empty enabledData when all disabled', () => {
    const store = useDataSourceStore()
    store.items = [
      { xing4_ming2: '张三', disabled: true },
      { xing4_ming2: '李四', disabled: true }
    ]

    expect(store.enabledData).toHaveLength(0)
  })

  it('should count total enabled students', () => {
    const store = useDataSourceStore()
    store.items = [
      { xing4_ming2: '张三', disabled: false },
      { xing4_ming2: '李四', disabled: true },
      { xing4_ming2: '王五', disabled: false }
    ]

    expect(store.totalCount).toBe(2)
  })

  it('should return 0 totalCount for empty data', () => {
    const store = useDataSourceStore()
    store.items = []
    expect(store.totalCount).toBe(0)
  })

  it('should calculate average correctly', () => {
    const configurationStore = useConfigurationStore()
    configurationStore.inputScoreTab = 'yu3_wen2'

    const store = useDataSourceStore()
    store.items = [
      { xing4_ming2: '张三', yu3_wen2: 80 },
      { xing4_ming2: '李四', yu3_wen2: 100 }
    ]

    expect(store.average).toBe(90)
  })

  it('should return 0 average for empty data', () => {
    const store = useDataSourceStore()
    store.items = []
    expect(store.average).toBe(0)
  })

  it('should calculate pass rate correctly', () => {
    const configurationStore = useConfigurationStore()
    configurationStore.inputScoreTab = 'yu3_wen2'

    const store = useDataSourceStore()
    store.items = [
      { xing4_ming2: '张三', yu3_wen2: 70 },
      { xing4_ming2: '李四', yu3_wen2: 50 },
      { xing4_ming2: '王五', yu3_wen2: 90 }
    ]

    expect(store.passRate).toBeCloseTo(66.67, 1)
  })

  it('should return 0 pass rate when no scores', () => {
    const configurationStore = useConfigurationStore()
    configurationStore.inputScoreTab = 'yu3_wen2'

    const store = useDataSourceStore()
    store.items = []

    expect(store.passRate).toBe(0)
  })

  it('should calculate excellent rate correctly', () => {
    const configurationStore = useConfigurationStore()
    configurationStore.inputScoreTab = 'yu3_wen2'

    const store = useDataSourceStore()
    store.items = [
      { xing4_ming2: '张三', yu3_wen2: 85 },
      { xing4_ming2: '李四', yu3_wen2: 70 },
      { xing4_ming2: '王五', yu3_wen2: 90 },
      { xing4_ming2: '赵六', yu3_wen2: 95 }
    ]

    expect(store.excellentRate).toBe(75)
  })

  it('should calculate optimum rate correctly', () => {
    const configurationStore = useConfigurationStore()
    configurationStore.inputScoreTab = 'yu3_wen2'

    const store = useDataSourceStore()
    store.items = [
      { xing4_ming2: '张三', yu3_wen2: 95 },
      { xing4_ming2: '李四', yu3_wen2: 70 }
    ]

    expect(store.optimumRate).toBe(50)
  })

  it('should calculate low score rate correctly', () => {
    const configurationStore = useConfigurationStore()
    configurationStore.inputScoreTab = 'yu3_wen2'

    const store = useDataSourceStore()
    store.items = [
      { xing4_ming2: '张三', yu3_wen2: 40 },
      { xing4_ming2: '李四', yu3_wen2: 70 }
    ]

    expect(store.lowScoreRate).toBe(50)
  })

  it('should determine hasAnyScore correctly', () => {
    const configurationStore = useConfigurationStore()
    configurationStore.inputScoreTab = 'yu3_wen2'

    const store = useDataSourceStore()
    store.items = []

    expect(store.hasAnyScore).toBe(false)
  })

  it('should get score for specific student', () => {
    const configurationStore = useConfigurationStore()
    configurationStore.inputScoreTab = 'yu3_wen2'

    const store = useDataSourceStore()
    store.items = [{ xing4_ming2: '张三', yu3_wen2: 85 }]

    expect(store.getItemScore(store.items[0])).toBe(85)
  })

  it('should return null when no score tab configured', () => {
    const configurationStore = useConfigurationStore()
    configurationStore.inputScoreTab = null

    const store = useDataSourceStore()
    store.items = [{ xing4_ming2: '张三', yu3_wen2: 85 }]

    expect(store.getItemScore(store.items[0])).toBeNull()
  })

  it('should calculate comprehensive rating correctly', () => {
    const configurationStore = useConfigurationStore()
    configurationStore.inputScoreTab = 'yu3_wen2'

    const store = useDataSourceStore()
    store.items = [
      { xing4_ming2: '张三', yu3_wen2: 85 },
      { xing4_ming2: '李四', yu3_wen2: 70 }
    ]

    const rating = store.comprehensiveRatingRate
    expect(rating).toBeGreaterThan(0)
    expect(rating).toBeLessThan(100)
  })
})
