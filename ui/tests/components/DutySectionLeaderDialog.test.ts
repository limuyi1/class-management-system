import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'

import DutySectionLeaderDialog from '@/views/duty-roster/components/DutySectionLeaderDialog.vue'

describe('DutySectionLeaderDialog', () => {
  it('saves the current independent section leader', async () => {
    const wrapper = mount(DutySectionLeaderDialog, {
      props: {
        modelValue: true,
        sectionName: '室内岗位',
        students: [{ id: 'student-1', name: '张三' }],
        leaderStudentId: 'student-1'
      },
      global: {
        stubs: {
          ElDialog: { template: '<div><slot /><slot name="footer" /></div>' },
          ElForm: { template: '<form><slot /></form>' },
          ElFormItem: { template: '<label><slot /></label>' },
          ElSelect: { template: '<div><slot /></div>' },
          ElOption: true,
          ElButton: { template: '<button type="button"><slot /></button>' }
        }
      }
    })

    await wrapper.findAll('button')[1].trigger('click')

    expect(wrapper.emitted('confirm')?.[0]).toEqual(['student-1'])
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([false])
  })
})
