import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'

import StudentSourceSelector from '@/components/student-source/StudentSourceSelector.vue'

/**
 * StudentSourceSelector 组件测试
 * 测试目标：学生数据来源选择器（系统学生 / Excel 名单）
 * 覆盖功能：来源信息与人数渲染、下拉菜单项渲染、来源切换 change 事件、
 * 无数据来源的切换防护、upload 上传事件（宿主据此打开外部名单管理弹窗）、
 * actions 插槽透传（外部名单管理弹窗的挂载位置）
 */

// ElDropdown 替身：同时渲染默认插槽与 dropdown 插槽，便于断言菜单内容
const dropdownStubs = {
  ElDropdown: { template: '<div><slot /><slot name="dropdown" /></div>' },
  ElDropdownMenu: { template: '<div class="dropdown-menu"><slot /></div>' },
  ElDropdownItem: { template: '<div class="dropdown-item"><slot /></div>' }
}

/** 直接调用组件内部命令处理方法，模拟用户在下拉菜单中选择命令 */
const invokeCommand = (
  wrapper: ReturnType<typeof mount>,
  command: string
): void => {
  ;(wrapper.vm as unknown as { handleCommand: (cmd: string) => void }).handleCommand(command)
}

describe('StudentSourceSelector', () => {
  it('renders system source info and menu entries', () => {
    const wrapper = mount(StudentSourceSelector, {
      props: { source: 'system', systemStudentCount: 30 },
      global: { stubs: dropdownStubs }
    })

    const triggerText = wrapper.get('.source-trigger').text()
    expect(triggerText).toContain('系统学生')
    expect(triggerText).toContain('30 人')
    // 无 Excel 文件名时，下拉菜单只有系统学生与“上传 Excel 名单”两个入口
    expect(wrapper.text()).toContain('系统学生（30）')
    expect(wrapper.text()).toContain('上传 Excel 名单')
    expect(wrapper.text()).not.toContain('更换 Excel 文件')
  })

  it('renders excel source info with the replace-file entry', () => {
    const wrapper = mount(StudentSourceSelector, {
      props: {
        source: 'excel',
        systemStudentCount: 30,
        excelFileName: '外班名单.xlsx',
        excelStudentCount: 42
      },
      global: { stubs: dropdownStubs }
    })

    const triggerText = wrapper.get('.source-trigger').text()
    expect(triggerText).toContain('外班名单.xlsx')
    expect(triggerText).toContain('42 人')
    expect(wrapper.text()).toContain('外班名单.xlsx（42）')
    expect(wrapper.text()).toContain('更换 Excel 文件')
  })

  it('emits change when switching between available sources', () => {
    const wrapper = mount(StudentSourceSelector, {
      props: {
        source: 'system',
        systemStudentCount: 30,
        excelFileName: '外班名单.xlsx',
        excelStudentCount: 42
      },
      global: { stubs: dropdownStubs }
    })

    invokeCommand(wrapper, 'excel')
    expect(wrapper.emitted('change')).toEqual([['excel']])

    invokeCommand(wrapper, 'system')
    expect(wrapper.emitted('change')).toEqual([
      ['excel'],
      ['system']
    ])
  })

  it('guards switching to sources without data', () => {
    const wrapper = mount(StudentSourceSelector, {
      props: { source: 'system', systemStudentCount: 0 },
      global: { stubs: dropdownStubs }
    })

    // 系统学生为 0 时不能切到 system；没有 Excel 文件名时不能切到 excel
    invokeCommand(wrapper, 'system')
    invokeCommand(wrapper, 'excel')
    expect(wrapper.emitted('change')).toBeUndefined()
  })

  it('emits upload and renders the actions slot holding the roster dialog', () => {
    const wrapper = mount(StudentSourceSelector, {
      props: {
        source: 'system',
        systemStudentCount: 30,
        excelFileName: '外班名单.xlsx',
        excelStudentCount: 42
      },
      global: { stubs: dropdownStubs },
      slots: {
        // 宿主的“管理外部名单”弹窗（ExcelStudentRosterDialog）挂在 actions 插槽里，
        // 这里用桩元素验证插槽透传
        actions: '<div class="roster-dialog-stub">管理外部学生名单弹窗</div>'
      }
    })

    expect(wrapper.get('.roster-dialog-stub').text()).toContain('管理外部学生名单弹窗')
    // upload 命令由宿主负责打开 ExcelStudentRosterDialog
    invokeCommand(wrapper, 'upload')
    expect(wrapper.emitted('upload')).toHaveLength(1)
  })
})
