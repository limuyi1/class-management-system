import { afterEach, describe, expect, it } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import ElementPlus from 'element-plus'

import { DutyRosterModeEnum, type DutyRosterType } from '@/types/DutyRoster'
import { createDefaultDutySections } from '@/utils/dutyRosterUntil'
import DutyRosterExportDialog from '@/views/duty-roster/components/DutyRosterExportDialog.vue'

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

afterEach(() => {
  document.body.innerHTML = ''
})

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
