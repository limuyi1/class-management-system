import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'

import ImportProgress from '@/views/setting/components/ImportProgress.vue'

/**
 * ImportProgress 组件测试
 * 测试目标：导入/导出/清空等长耗时操作的进度提示弹窗
 * 覆盖功能：默认标题与进度渲染、自定义标题与百分比渲染、
 * 弹窗 modelValue 与 visible 双向绑定同步、关闭状态回传（update:visible）
 */

const mountProgress = (props: { visible?: boolean; title?: string; percent?: number } = {}) =>
  mount(ImportProgress, {
    props: { visible: true, ...props },
    global: {
      stubs: {
        ElDialog: {
          name: 'ElDialog',
          props: ['modelValue', 'title'],
          template: '<div><span class="dialog-title">{{ title }}</span><slot /></div>'
        },
        ElProgress: {
          name: 'ElProgress',
          props: ['percentage'],
          template: '<div class="progress-value">{{ percentage }}</div>'
        }
      }
    }
  })

describe('ImportProgress', () => {
  it('renders the default title and zero percent', () => {
    const wrapper = mountProgress()

    expect(wrapper.get('.dialog-title').text()).toBe('正在处理...')
    expect(wrapper.get('.progress-value').text()).toBe('0')
    expect(wrapper.text()).toContain('请勿关闭页面')
  })

  it('renders the custom title and percent', () => {
    const wrapper = mountProgress({ title: '正在导入数据', percent: 60 })

    expect(wrapper.get('.dialog-title').text()).toBe('正在导入数据')
    expect(wrapper.get('.progress-value').text()).toBe('60')
  })

  it('emits update:visible false when the parent hides the dialog', async () => {
    const wrapper = mountProgress()

    // 初始渲染不主动回传状态
    expect(wrapper.emitted('update:visible')).toBeUndefined()
    await wrapper.setProps({ visible: false })
    expect(wrapper.emitted('update:visible')).toEqual([[false]])
  })

  it('syncs the dialog model with the visible prop in both directions', async () => {
    const wrapper = mountProgress({ visible: false })
    const dialog = wrapper.getComponent({ name: 'ElDialog' })

    expect(dialog.props('modelValue')).toBe(false)
    await wrapper.setProps({ visible: true })
    expect(dialog.props('modelValue')).toBe(true)
    expect(wrapper.emitted('update:visible')).toEqual([[true]])
  })
})
