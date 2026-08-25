import { afterEach, describe, expect, it } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import ElementPlus from 'element-plus'

import { DutyRosterModeEnum, type DutyRosterType } from '@/types/DutyRoster'
import { createDefaultDutySections } from '@/utils/duty-roster/dutyRosterUtil'
import DutyRosterExportDialog from '@/views/duty-roster/components/DutyRosterExportDialog.vue'

/**
 * DutyRosterExportDialog 组件测试
 * 测试目标：值日表导出对话框
 * 覆盖功能：对话框挂载到 body 浮层、浮层层级与导出工作区渲染
 */

/** 构造一份默认的每日值日安排测试数据 */
function createRoster(): DutyRosterType {
  return {
    id: 'roster-1',
    name: '班级值日安排',
    mode: DutyRosterModeEnum.Daily,
    studentSource: 'system',
    sections: createDefaultDutySections(),
    weeklyRows: [{ id: 'weekly-row-1', sortOrder: 0 }],
    assignments: [],
    leaders: [],
    notes: '',
    createdAt: '',
    updatedAt: ''
  }
}

// 每个用例结束后清空 body，避免挂载到 body 的浮层残留影响后续断言
afterEach(() => {
  document.body.innerHTML = ''
})

// 验证导出对话框以浮层形式追加到 body 并渲染完整工作区
describe('DutyRosterExportDialog', () => {
  it('appends the complete workspace to the body overlay', async () => {
    const wrapper = mount(DutyRosterExportDialog, {
      attachTo: document.body,
      props: {
        modelValue: true,
        roster: createRoster(),
        studentNames: {}
      },
      global: { plugins: [ElementPlus] }
    })

    await flushPromises()

    const overlay = document.body.querySelector<HTMLElement>('.el-overlay')
    expect(overlay).not.toBeNull()
    expect(Number(overlay?.style.zIndex)).toBeGreaterThanOrEqual(2000)
    expect(overlay?.querySelector('.export-workspace')).not.toBeNull()

    wrapper.unmount()
  })
})
