import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'

import ExcelStudentRosterDialog from '@/components/student-source/ExcelStudentRosterDialog.vue'

import type { StudentSourceStudentType } from '@/types/StudentSource'

/**
 * ExcelStudentRosterDialog 组件测试
 * 测试目标：外部学生名单管理弹窗容器（组合 ExcelStudentAddForm 与 ExcelStudentList）
 * 覆盖功能：scopeLabel 说明渲染、新增表单提交转发为 add 事件、名单删除转发为 remove 事件、
 * 底部“完成”按钮关闭弹窗（update:modelValue）、弹窗不可见时不渲染内部内容
 */

const students: StudentSourceStudentType[] = [
  { id: 'excel:0', name: '张三' },
  { id: 'excel:1', name: '李四' }
]

const mountDialog = (modelValue = true) =>
  mount(ExcelStudentRosterDialog, {
    props: {
      modelValue,
      students,
      assignedStudentIds: ['excel:0'],
      scopeLabel: '座位表'
    },
    global: {
      stubs: {
        ElDialog: { template: '<div><slot /><slot name="footer" /></div>' },
        // 与 el-input 行为一致的最小替身，支撑 AddForm / List 的 v-model 与占位符
        ElInput: {
          props: ['modelValue', 'placeholder', 'maxlength', 'clearable'],
          template:
            '<input :value="modelValue" :placeholder="placeholder" :maxlength="maxlength" @input="$emit(\'update:modelValue\', $event.target.value)" />'
        },
        // 未声明 props，aria-label 等属性自动透传到根元素
        ElButton: { template: '<button type="button"><slot /></button>' },
        ElTag: { template: '<span class="el-tag-stub"><slot /></span>' },
        ElEmpty: { template: '<div class="el-empty-stub">{{ description }}</div>' }
      }
    }
  })

describe('ExcelStudentRosterDialog', () => {
  it('renders the scope description and the student list with assignment state', () => {
    const wrapper = mountDialog()

    expect(wrapper.get('.excel-student-roster-dialog').exists()).toBe(true)
    expect(wrapper.text()).toContain('此处的增删只影响座位表')
    expect(wrapper.text()).toContain('张三')
    expect(wrapper.text()).toContain('李四')
    // 已安排的学生展示“已安排”标签
    expect(wrapper.text()).toContain('已安排')
  })

  it('forwards add form submissions as add events', async () => {
    const wrapper = mountDialog()

    await wrapper.get('input[placeholder="输入学生姓名"]').setValue('王五')
    await wrapper.get('form').trigger('submit')

    expect(wrapper.emitted('add')).toEqual([['王五']])
    // 提交后表单输入被内部 AddForm 清空
    expect(
      (wrapper.get('input[placeholder="输入学生姓名"]').element as HTMLInputElement).value
    ).toBe('')
  })

  it('forwards list removals as remove events', async () => {
    const wrapper = mountDialog()

    await wrapper.get('[aria-label="从名单删除张三"]').trigger('click')

    expect(wrapper.emitted('remove')).toEqual([[{ id: 'excel:0', name: '张三' }]])
  })

  it('closes via the footer done button', async () => {
    const wrapper = mountDialog()

    const doneButton = wrapper.findAll('button').find((button) => button.text() === '完成')
    expect(doneButton).toBeTruthy()
    await doneButton!.trigger('click')

    expect(wrapper.emitted('update:modelValue')).toEqual([[false]])
  })

  it('renders nothing inside when not visible', async () => {
    const wrapper = mountDialog(false)

    expect(wrapper.find('.excel-student-roster-dialog').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('张三')

    await wrapper.setProps({ modelValue: true })
    expect(wrapper.find('.excel-student-roster-dialog').exists()).toBe(true)
    expect(wrapper.text()).toContain('张三')
  })
})
