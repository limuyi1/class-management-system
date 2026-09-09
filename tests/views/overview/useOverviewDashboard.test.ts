import { nextTick } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

import { useOverviewDashboard } from '@/views/overview/composables/useOverviewDashboard'
import { useDataSourceStore } from '@/stores/data-source'
import { useSettingStore } from '@/stores/setting'
import { NAME_PROP } from '@/constants'

import type { SettingType } from '@/types/Setting'
import type { StudentDataType } from '@/types/StudentData'

/**
 * useOverviewDashboard 组合式函数测试
 * 测试目标：总览页核心状态管理
 * 覆盖功能：初始化自动选中首个学生、学生失效后的兜底选择、
 * 对比人数上限截断、单人聚焦、添加/移除对比与超限警告、总览数据构建
 */

const messageMocks = vi.hoisted(() => ({
  warning: vi.fn()
}))
vi.mock('element-plus', () => ({
  ElMessage: messageMocks
}))

/** 表头 fixture：三个单元列 */
const unitHeaders: SettingType[] = [
  { prop: 'unit1', label: '第一单元', disabled: false },
  { prop: 'unit2', label: '第二单元', disabled: false },
  { prop: 'unit3', label: '第三单元', disabled: false }
]

/** 学生 fixture 工厂 */
const createStudent = (studentId: string, name: string): StudentDataType => ({
  studentId,
  [NAME_PROP]: name,
  unit1: 80 + Number(studentId.slice(1)),
  unit2: 82,
  unit3: 90
})

describe('useOverviewDashboard', () => {
  let dataStore: ReturnType<typeof useDataSourceStore>
  let settingStore: ReturnType<typeof useSettingStore>

  beforeEach(() => {
    setActivePinia(createPinia())
    dataStore = useDataSourceStore()
    settingStore = useSettingStore()
    settingStore.scoreColumns = [...unitHeaders]
    messageMocks.warning.mockClear()
  })

  it('auto-selects the first student on initialization', async () => {
    dataStore.students = [createStudent('s1', '安一'), createStudent('s2', '贝二')]

    const { selectedStudentIds } = useOverviewDashboard()
    await nextTick()

    expect(selectedStudentIds.value).toEqual(['s1'])
  })

  it('builds dashboard data from store state', async () => {
    dataStore.students = [createStudent('s1', '安一'), createStudent('s2', '贝二')]

    const { dashboardData } = useOverviewDashboard()
    await nextTick()

    expect(dashboardData.value.kpi.totalUnitCount).toBe(3)
    expect(dashboardData.value.studentOptions).toHaveLength(2)
    expect(dashboardData.value.studentTrend?.students).toHaveLength(1)
  })

  it('falls back to the first valid student when the selection becomes invalid', async () => {
    dataStore.students = [createStudent('s1', '安一'), createStudent('s2', '贝二')]
    const { selectedStudentIds } = useOverviewDashboard()
    await nextTick()
    selectedStudentIds.value = ['s2']

    // 数据源替换后 s2 失效，自动回退到新的首个学生
    dataStore.students = [createStudent('s1', '安一'), createStudent('s3', '陈三')]
    await nextTick()

    expect(selectedStudentIds.value).toEqual(['s1'])
  })

  it('truncates selection beyond the max compare count', async () => {
    dataStore.students = [createStudent('s1', '安一'), createStudent('s2', '贝二')]
    const { selectedStudentIds } = useOverviewDashboard()
    await nextTick()

    selectedStudentIds.value = ['s1', 's2', 's3', 's4']
    dataStore.students = [
      createStudent('s1', '安一'),
      createStudent('s2', '贝二'),
      createStudent('s3', '陈三'),
      createStudent('s4', '丁四')
    ]
    await nextTick()

    // maxCompareCount 为 3，超出部分被截断
    expect(selectedStudentIds.value).toHaveLength(3)
  })

  it('focuses a single student or clears the selection', async () => {
    dataStore.students = [createStudent('s1', '安一'), createStudent('s2', '贝二')]
    const { selectedStudentIds, focusStudent } = useOverviewDashboard()
    await nextTick()

    focusStudent('s2')
    expect(selectedStudentIds.value).toEqual(['s2'])

    focusStudent(null)
    expect(selectedStudentIds.value).toEqual([])
  })

  it('adds students to comparison and moves re-selected students to the end', async () => {
    dataStore.students = [createStudent('s1', '安一'), createStudent('s2', '贝二')]
    const { selectedStudentIds, selectStudent } = useOverviewDashboard()
    await nextTick()

    selectStudent('s2')
    expect(selectedStudentIds.value).toEqual(['s1', 's2'])

    // 重复选择不会重复添加，仅将该学生移动到末尾
    selectStudent('s1')
    expect(selectedStudentIds.value).toEqual(['s2', 's1'])
  })

  it('clears selection when selecting null', async () => {
    dataStore.students = [createStudent('s1', '安一'), createStudent('s2', '贝二')]
    const { selectedStudentIds, selectStudent } = useOverviewDashboard()
    await nextTick()

    selectStudent(null)
    expect(selectedStudentIds.value).toEqual([])
  })

  it('warns when the compare limit is exceeded', async () => {
    dataStore.students = [
      createStudent('s1', '安一'),
      createStudent('s2', '贝二'),
      createStudent('s3', '陈三'),
      createStudent('s4', '丁四')
    ]
    const { selectedStudentIds, selectStudent } = useOverviewDashboard()
    await nextTick()

    selectStudent('s2')
    selectStudent('s3')
    selectStudent('s4')

    expect(messageMocks.warning).toHaveBeenCalledWith('最多只能对比 3 名学生')
    expect(selectedStudentIds.value).toEqual(['s1', 's2', 's3'])
  })
})
