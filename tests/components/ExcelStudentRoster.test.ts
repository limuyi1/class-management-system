import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import ElementPlus from 'element-plus'

import ExcelStudentAddForm from '@/components/student-source/ExcelStudentAddForm.vue'
import ExcelStudentList from '@/components/student-source/ExcelStudentList.vue'

describe('Excel student roster controls', () => {
  it('trims and submits a student name while allowing duplicate names', async () => {
    const wrapper = mount(ExcelStudentAddForm, {
      props: { existingNames: ['张三'] },
      global: { plugins: [ElementPlus] }
    })

    await wrapper.get('input').setValue(' 张三 ')
    expect(wrapper.text()).toContain('名单中已有同名学生')

    await wrapper.get('form').trigger('submit')
    expect(wrapper.emitted('submit')).toEqual([['张三']])
    expect((wrapper.get('input').element as HTMLInputElement).value).toBe('')
  })

  it('filters students and emits the selected student for removal', async () => {
    const wrapper = mount(ExcelStudentList, {
      props: {
        students: [
          { id: 'excel:0', name: '张三' },
          { id: 'excel:1', name: '李四' }
        ],
        assignedStudentIds: ['excel:0']
      },
      global: { plugins: [ElementPlus] }
    })

    expect(wrapper.text()).toContain('已安排')
    await wrapper.get('input').setValue('李')
    expect(wrapper.text()).not.toContain('张三')
    expect(wrapper.text()).toContain('李四')

    await wrapper.get('[aria-label="从名单删除李四"]').trigger('click')
    expect(wrapper.emitted('remove')).toEqual([[{ id: 'excel:1', name: '李四' }]])
  })
})
