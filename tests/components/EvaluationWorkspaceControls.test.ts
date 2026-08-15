import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import ElementPlus from 'element-plus'
import { nextTick } from 'vue'

import ConfigurationCard from '../../src/views/evaluation/components/ConfigurationCard.vue'
import EvaluationInputCard from '../../src/views/evaluation/components/EvaluationInputCard.vue'
import CommentWorkspaceToolbar from '../../src/views/evaluation/components/CommentWorkspaceToolbar.vue'
import { NAME_PROP } from '../../src/constants'

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: vi.fn() })
}))

const mountOptions = {
  global: {
    plugins: [ElementPlus],
    stubs: {
      FontAwesomeIcon: true
    }
  }
}

describe('evaluation workspace controls', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('keeps preview settings collapsed by default', async () => {
    const wrapper = mount(ConfigurationCard, mountOptions)

    expect(wrapper.get('.config-body--basic').attributes('style')).toContain('display: none')
    expect(wrapper.get('.config-body--advanced').attributes('style')).toContain('display: none')

    await wrapper.get('.config-summary').trigger('click')
    expect(wrapper.get('.config-body--basic').attributes('style') || '').not.toContain(
      'display: none'
    )
  })

  it('keeps batch and export as the only labeled workspace actions', () => {
    const wrapper = mount(CommentWorkspaceToolbar, {
      ...mountOptions,
      props: {
        source: 'system',
        systemStudentCount: 30,
        completedCount: 18,
        totalCount: 30,
        percentage: 60,
        hasData: true,
        batchProcessing: false,
        exporting: false,
        displayHandwriteFontName: '默认手写字体',
        handwriteFontApplying: false
      }
    })

    const labeledActions = wrapper.findAll('.workspace-action-btn')
    expect(labeledActions).toHaveLength(2)
    expect(labeledActions.map((button) => button.text())).toEqual([
      expect.stringContaining('批量处理'),
      expect.stringContaining('导出')
    ])
    expect(wrapper.findAll('.workspace-more-btn')).toHaveLength(1)
  })

  it('shows only AI assistant and save as persistent editor actions', async () => {
    const students = [{ studentId: 'student-1', [NAME_PROP]: '张三' }]
    const wrapper = mount(EvaluationInputCard, {
      ...mountOptions,
      props: {
        students,
        tagCategoryList: []
      }
    })

    wrapper.vm.editData(students[0])
    await nextTick()

    const actionButtons = wrapper.findAll('.action-row .el-button')
    expect(actionButtons).toHaveLength(2)
    expect(wrapper.get('.ai-assistant-btn').text()).toContain('AI 生成')
    expect(wrapper.get('.submit-btn').text()).toContain('保存并下一个')
  })

  it('changes the single AI control to polish when a comment already exists', async () => {
    const students = [{ studentId: 'student-1', [NAME_PROP]: '张三', comment: '已经填写的评语' }]
    const wrapper = mount(EvaluationInputCard, {
      ...mountOptions,
      props: {
        students,
        tagCategoryList: []
      }
    })

    wrapper.vm.editData(students[0])
    await nextTick()

    expect(wrapper.get('.ai-assistant-btn').text()).toContain('AI 润色')
    expect(wrapper.findAll('.action-row .el-button')).toHaveLength(2)
  })
})
