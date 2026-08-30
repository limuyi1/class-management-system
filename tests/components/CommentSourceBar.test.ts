import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'

import CommentSourceBar from '../../src/views/evaluation/components/CommentSourceBar.vue'

/**
 * CommentSourceBar 组件测试
 * 测试目标：评语来源切换栏（系统学生 / Excel 两种来源合并为一个触发入口）
 * 覆盖功能：来源信息展示、Excel 来源状态、空系统来源时禁止切换
 */
describe('CommentSourceBar', () => {
  it('condenses source selection into one trigger', async () => {
    const wrapper = mount(CommentSourceBar, {
      props: {
        source: 'system',
        systemStudentCount: 30
      },
      global: {
        stubs: {
          FontAwesomeIcon: true,
          // 替身 ElDropdown：同时渲染默认插槽与 dropdown 插槽，便于断言菜单内容
          ElDropdown: {
            template: '<div><slot /><slot name="dropdown" /></div>'
          },
          ElDropdownMenu: true,
          ElDropdownItem: true
        }
      }
    })

    expect(wrapper.get('.source-trigger').text()).toContain('系统学生')
    expect(wrapper.get('.source-trigger').text()).toContain('30 人')
    expect(wrapper.findAll('.source-trigger')).toHaveLength(1)
    // 直接调用组件实例方法模拟选择 Excel 来源，验证对外触发的 change 事件
    ;(
      wrapper.vm as unknown as { handleSourceCommand: (command: string) => void }
    ).handleSourceCommand('excel')
    expect(wrapper.emitted('change')).toEqual([['excel']])
  })

  it('shows Excel source state without a second visible upload button', async () => {
    const wrapper = mount(CommentSourceBar, {
      props: {
        source: 'excel',
        systemStudentCount: 30,
        excelFileName: '外班评语.xlsx',
        excelStudentCount: 42
      },
      global: {
        stubs: {
          FontAwesomeIcon: true,
          // 替身 ElDropdown：同时渲染默认插槽与 dropdown 插槽，便于断言菜单内容
          ElDropdown: {
            template: '<div><slot /><slot name="dropdown" /></div>'
          },
          ElDropdownMenu: true,
          ElDropdownItem: true
        }
      }
    })

    expect(wrapper.get('.source-trigger').text()).toContain('外班评语.xlsx')
    expect(wrapper.get('.source-trigger').text()).toContain('42 人')
    expect(wrapper.text()).not.toContain('不写入系统')
    expect(wrapper.find('.replace-file').exists()).toBe(false)
    // 模拟再次点击上传入口，验证对外触发的 upload 事件
    ;(
      wrapper.vm as unknown as { handleSourceCommand: (command: string) => void }
    ).handleSourceCommand('upload')
    expect(wrapper.emitted('upload')).toHaveLength(1)
  })

  it('does not allow switching to an empty system source', async () => {
    const wrapper = mount(CommentSourceBar, {
      props: {
        source: 'excel',
        systemStudentCount: 0,
        excelFileName: '临时数据.xlsx',
        excelStudentCount: 12
      },
      global: {
        stubs: {
          FontAwesomeIcon: true,
          // 替身 ElDropdown：同时渲染默认插槽与 dropdown 插槽，便于断言菜单内容
          ElDropdown: {
            template: '<div><slot /><slot name="dropdown" /></div>'
          },
          ElDropdownMenu: true,
          ElDropdownItem: true
        }
      }
    })

    // 系统学生数为 0 时尝试切回系统来源，应被拦截且不触发 change 事件
    ;(
      wrapper.vm as unknown as { handleSourceCommand: (command: string) => void }
    ).handleSourceCommand('system')
    expect(wrapper.emitted('change')).toBeUndefined()
  })
})
