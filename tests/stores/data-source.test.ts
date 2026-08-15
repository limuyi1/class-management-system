import { describe, expect, it, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { nextTick } from 'vue'
import { useDataSourceStore } from '../../src/stores/data-source'
import { useConfigurationStore } from '../../src/stores/configuration'
import type { StudentDataType } from '../../src/types/StudentData'

describe('useDataSourceStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('should initialize with empty data', () => {
    const store = useDataSourceStore()
    expect(store.students).toEqual([])
  })

  it('should set data correctly', () => {
    const store = useDataSourceStore()
    const testData = [
      { name: '张三', yu3_wen2: 85 },
      { name: '李四', yu3_wen2: 90 }
    ]
    store.students = testData
    expect(store.students).toEqual(testData)
  })

  it('should find the correct student by ID when names are duplicated', () => {
    const store = useDataSourceStore()
    store.students = [
      { studentId: 'student-1', name: '张三' },
      { studentId: 'student-2', name: '张三' }
    ]

    expect(store.getStudentById('student-2')).toBe(store.students[1])
  })

  it('should filter disabled students in enabledData', () => {
    const store = useDataSourceStore()
    store.students = [
      { name: '张三', disabled: false },
      { name: '李四', disabled: true },
      { name: '王五', disabled: false }
    ]

    const enabled = store.enabledData
    expect(enabled).toHaveLength(2)
    expect(enabled.map((student) => student.name)).toEqual(['张三', '王五'])
  })

  it('should return empty enabledData when all disabled', () => {
    const store = useDataSourceStore()
    store.students = [
      { name: '张三', disabled: true },
      { name: '李四', disabled: true }
    ]

    expect(store.enabledData).toHaveLength(0)
  })

  it('should count total enabled students', () => {
    const store = useDataSourceStore()
    store.students = [
      { name: '张三', disabled: false },
      { name: '李四', disabled: true },
      { name: '王五', disabled: false }
    ]

    expect(store.totalCount).toBe(2)
  })

  it('should return 0 totalCount for empty data', () => {
    const store = useDataSourceStore()
    store.students = []
    expect(store.totalCount).toBe(0)
  })

  it('should calculate average correctly', () => {
    const configurationStore = useConfigurationStore()
    configurationStore.inputScoreTab = 'yu3_wen2'

    const store = useDataSourceStore()
    store.students = [
      { name: '张三', yu3_wen2: 80 },
      { name: '李四', yu3_wen2: 100 }
    ]

    expect(store.average).toBe(90)
  })

  it('should return 0 average for empty data', () => {
    const store = useDataSourceStore()
    store.students = []
    expect(store.average).toBe(0)
  })

  it('should calculate pass rate correctly', () => {
    const configurationStore = useConfigurationStore()
    configurationStore.inputScoreTab = 'yu3_wen2'

    const store = useDataSourceStore()
    store.students = [
      { name: '张三', yu3_wen2: 70 },
      { name: '李四', yu3_wen2: 50 },
      { name: '王五', yu3_wen2: 90 }
    ]

    expect(store.passRate).toBeCloseTo(66.67, 1)
  })

  it('should return 0 pass rate when no scores', () => {
    const configurationStore = useConfigurationStore()
    configurationStore.inputScoreTab = 'yu3_wen2'

    const store = useDataSourceStore()
    store.students = []

    expect(store.passRate).toBe(0)
  })

  it('should calculate excellent rate correctly', () => {
    const configurationStore = useConfigurationStore()
    configurationStore.inputScoreTab = 'yu3_wen2'

    const store = useDataSourceStore()
    store.students = [
      { name: '张三', yu3_wen2: 85 },
      { name: '李四', yu3_wen2: 70 },
      { name: '王五', yu3_wen2: 90 },
      { name: '赵六', yu3_wen2: 95 }
    ]

    expect(store.excellentRate).toBe(75)
  })

  it('should calculate optimum rate correctly', () => {
    const configurationStore = useConfigurationStore()
    configurationStore.inputScoreTab = 'yu3_wen2'

    const store = useDataSourceStore()
    store.students = [
      { name: '张三', yu3_wen2: 95 },
      { name: '李四', yu3_wen2: 70 }
    ]

    expect(store.optimumRate).toBe(50)
  })

  it('should calculate low score rate correctly', () => {
    const configurationStore = useConfigurationStore()
    configurationStore.inputScoreTab = 'yu3_wen2'

    const store = useDataSourceStore()
    store.students = [
      { name: '张三', yu3_wen2: 40 },
      { name: '李四', yu3_wen2: 70 }
    ]

    expect(store.lowScoreRate).toBe(50)
  })

  it('should determine hasAnyScore correctly', () => {
    const configurationStore = useConfigurationStore()
    configurationStore.inputScoreTab = 'yu3_wen2'

    const store = useDataSourceStore()
    store.students = []

    expect(store.hasAnyScore).toBe(false)
  })

  it('should get score for specific student', () => {
    const configurationStore = useConfigurationStore()
    configurationStore.inputScoreTab = 'yu3_wen2'

    const store = useDataSourceStore()
    store.students = [{ name: '张三', yu3_wen2: 85 }]

    expect(store.getItemScore(store.students[0])).toBe(85)
  })

  it('should return null when no score tab configured', () => {
    const configurationStore = useConfigurationStore()
    configurationStore.inputScoreTab = null

    const store = useDataSourceStore()
    store.students = [{ name: '张三', yu3_wen2: 85 }]

    expect(store.getItemScore(store.students[0])).toBeNull()
  })

  it('should calculate comprehensive rating correctly', () => {
    const configurationStore = useConfigurationStore()
    configurationStore.inputScoreTab = 'yu3_wen2'

    const store = useDataSourceStore()
    store.students = [
      { name: '张三', yu3_wen2: 85 },
      { name: '李四', yu3_wen2: 70 }
    ]

    const rating = store.comprehensiveRatingRate
    expect(rating).toBeGreaterThan(0)
    expect(rating).toBeLessThan(100)
  })

  it('should ignore non-number scores in statistics', () => {
    const configurationStore = useConfigurationStore()
    configurationStore.inputScoreTab = 'yu3_wen2'

    const store = useDataSourceStore()
    store.students = [
      { name: '张三', yu3_wen2: 80 },
      { name: '李四', yu3_wen2: '90' },
      { name: '王五', yu3_wen2: null }
    ] as StudentDataType[]

    expect(store.validScores).toEqual([80])
    expect(store.average).toBe(80)
  })

  it('should resolve waitForInitReady immediately when already initialized', async () => {
    const store = useDataSourceStore()
    store.isDataReady = true

    await expect(store.waitForInitReady()).resolves.toBe(true)
  })

  it('should wait for initialization state change in waitForInitReady', async () => {
    const store = useDataSourceStore()
    store.isDataReady = false

    const pending = store.waitForInitReady()
    store.isDataReady = true
    await nextTick()

    await expect(pending).resolves.toBe(true)
  })

})
