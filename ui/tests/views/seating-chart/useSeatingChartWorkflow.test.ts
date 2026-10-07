/** 验证拆分后的名单与交互仍共享选择状态，并保留来源切换和快捷键行为。 */
import { defineComponent } from 'vue'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'

import { useDataSourceStore } from '../../../src/stores/data-source'
import { useSeatingChartStore } from '../../../src/stores/seating-chart'
import { useSeatingChartInteraction } from '../../../src/views/seating-chart/composables/useSeatingChartInteraction'
import { useSeatingChartStudents } from '../../../src/views/seating-chart/composables/useSeatingChartStudents'

const confirm = vi.hoisted(() => vi.fn())

vi.mock('element-plus', () => ({
  ElMessageBox: { confirm },
  ElMessage: { success: vi.fn(), warning: vi.fn() }
}))

let interaction: ReturnType<typeof useSeatingChartInteraction>

let students: ReturnType<typeof useSeatingChartStudents>

let wrapper: ReturnType<typeof mount>

beforeEach(() => {
  setActivePinia(createPinia())
  confirm.mockReset().mockResolvedValue('confirm')
  useDataSourceStore().students = [{ studentId: 's1', name: '张三' }]
  wrapper = mount(
    defineComponent({
      setup() {
        interaction = useSeatingChartInteraction()
        students = useSeatingChartStudents(interaction)
        return {}
      },
      template: '<div />'
    })
  )
})

afterEach(() => wrapper.unmount())

describe('座位表页面流程', () => {
  it('取消更换来源时保留已有座位，不打开导入弹窗', async () => {
    const store = useSeatingChartStore()
    store.createChart({ studentSource: 'system', rows: 1, columns: 1 })
    store.assignStudent('s1', 0, 0)
    confirm.mockRejectedValueOnce('cancel')

    await students.handleStudentSourceChange('excel')

    expect(store.editingChart?.studentSource).toBe('system')
    expect(store.assignedCount).toBe(1)
    expect(students.studentImportVisible.value).toBe(false)
  })

  it('移除外部名单学生时同时清理共享的选择和菜单状态', async () => {
    const store = useSeatingChartStore()
    store.createChart({
      studentSource: 'excel',
      rows: 1,
      columns: 1,
      excelSource: { fileName: '名单.xlsx', students: [{ id: 'e1', name: '李四' }] }
    })
    interaction.selectedStudentId.value = 'e1'
    interaction.openStudentMenu('e1', 10, 20)

    await students.removeExcelStudent({ id: 'e1', name: '李四' })

    expect(store.activeStudents).toEqual([])
    expect(interaction.selectedStudentId.value).toBeNull()
    expect(interaction.studentMenu.value).toBeNull()
  })

  it('Esc 关闭全屏和菜单，卸载后不再响应页面快捷键', () => {
    interaction.fullscreen.value = true
    interaction.openStudentMenu('s1', 10, 20)
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(interaction.fullscreen.value).toBe(false)
    expect(interaction.studentMenu.value).toBeNull()

    wrapper.unmount()
    interaction.fullscreen.value = true
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(interaction.fullscreen.value).toBe(true)
  })
})
