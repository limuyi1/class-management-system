import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'

import CommentSourceBar from '../../src/views/evaluation/components/CommentSourceBar.vue'

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
          ElDropdown: {
            template: '<div><slot /><slot name="dropdown" /></div>'
          },
          ElDropdownMenu: true,
          ElDropdownItem: true
        }
      }
    })

    ;(
      wrapper.vm as unknown as { handleSourceCommand: (command: string) => void }
    ).handleSourceCommand('system')
    expect(wrapper.emitted('change')).toBeUndefined()
  })
})
