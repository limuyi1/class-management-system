import { afterEach, describe, expect, it } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import ElementPlus, { ElInputNumber } from 'element-plus'

import StudentFormDialog from '@/views/student-info/components/StudentFormDialog.vue'

afterEach(() => {
  document.body.innerHTML = ''
})

describe('StudentFormDialog', () => {
  it('submits trimmed student values from the add dialog', async () => {
    const wrapper = mount(StudentFormDialog, {
      attachTo: document.body,
      props: {
        modelValue: true,
        student: null,
        scoreColumns: [{ prop: 'math', label: '数学', disabled: false }],
        sequence: 2,
        maxSequence: 3
      },
      global: { plugins: [ElementPlus] }
    })
    await flushPromises()

    const nameInput = document.body.querySelector<HTMLInputElement>(
      'input[placeholder="请输入学生姓名"]'
    )
    expect(nameInput).not.toBeNull()
    nameInput!.value = ' 张三 '
    nameInput!.dispatchEvent(new Event('input'))
    const numberInputs = wrapper.findAllComponents(ElInputNumber)
    expect(numberInputs).toHaveLength(2)
    await numberInputs[1].setValue(95.5)
    const commentInput = document.body.querySelector<HTMLTextAreaElement>(
      'textarea[placeholder="请输入学生期末评语"]'
    )
    commentInput!.value = ' 这是一条期末评语。 '
    commentInput!.dispatchEvent(new Event('input'))
    await flushPromises()

    const buttons = [...document.body.querySelectorAll<HTMLButtonElement>('button')]
    buttons.find((button) => button.textContent?.includes('保存'))?.click()
    await flushPromises()

    expect(wrapper.emitted('save')?.[0]).toEqual([
      { name: '张三', disabled: false, comment: '这是一条期末评语。', math: 95.5 },
      2
    ])
    wrapper.unmount()
  })

  it('uses number inputs for scores and restores existing comment and sequence', async () => {
    const wrapper = mount(StudentFormDialog, {
      attachTo: document.body,
      props: {
        modelValue: true,
        student: {
          studentId: 'student-1',
          name: '李四',
          math: 88,
          comment: '已有评语'
        },
        scoreColumns: [{ prop: 'math', label: '数学', disabled: false }],
        sequence: 3,
        maxSequence: 4
      },
      global: { plugins: [ElementPlus] }
    })
    await flushPromises()

    const numberInputs = wrapper.findAllComponents(ElInputNumber)
    expect(numberInputs[0].props('modelValue')).toBe(3)
    expect(numberInputs[1].props('modelValue')).toBe(88)
    expect(
      document.body.querySelector<HTMLTextAreaElement>(
        'textarea[placeholder="请输入学生期末评语"]'
      )?.value
    ).toBe('已有评语')
    wrapper.unmount()
  })
})
