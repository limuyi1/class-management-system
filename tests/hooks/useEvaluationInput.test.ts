import { defineComponent, nextTick, ref } from 'vue'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useEvaluationInput } from '../../src/hooks/useEvaluationInput'
import { useDataSourceStore } from '../../src/stores/data-source'
import { NAME_PROP } from '../../src/types/Constants'

const routerPush = vi.fn()

vi.mock('vue-router', () => ({
  useRouter: () => ({
    push: routerPush
  })
}))

const Harness = defineComponent({
  setup() {
    const input = useEvaluationInput({
      onScroll: vi.fn()
    })

    return { input }
  },
  template: '<div />'
})

const TemporaryHarness = defineComponent({
  setup() {
    const students = ref([
      {
        studentId: 'excel:1',
        [NAME_PROP]: '外班学生',
        comment: '',
        tags: { temporary: ['认真'] }
      }
    ])
    const input = useEvaluationInput({
      students,
      tagCategoryList: ref([{ prop: 'temporary', label: '临时标签' }]),
      allowTagEditing: false,
      onScroll: vi.fn()
    })

    return { input, students }
  },
  template: '<div />'
})

describe('useEvaluationInput', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    routerPush.mockClear()
  })

  it('should navigate to standalone student info page when editing tags from comment editor', async () => {
    const dataSourceStore = useDataSourceStore()
    dataSourceStore.students = [{ studentId: 'student-1', [NAME_PROP]: '张三', comment: '评语' }]

    const wrapper = mount(Harness)
    wrapper.vm.input.editData(dataSourceStore.students[0])
    await nextTick()

    wrapper.vm.input.goToEditTags()

    expect(routerPush).toHaveBeenCalledWith({
      path: '/student-info',
      query: {
        'edit-tags': '1',
        'student-id': 'student-1',
        'return-to': 'comment',
        'return-student-id': 'student-1'
      }
    })
  })

  it('edits temporary Excel rows without writing to the system store or tag editor', async () => {
    const dataSourceStore = useDataSourceStore()
    dataSourceStore.students = [{ studentId: 'system-1', [NAME_PROP]: '本班学生' }]
    const wrapper = mount(TemporaryHarness)

    wrapper.vm.input.editData(wrapper.vm.students[0])
    await nextTick()
    wrapper.vm.input.formData.comment = '临时处理结果'
    wrapper.vm.input.onSubmit()
    wrapper.vm.input.goToEditTags()

    expect(wrapper.vm.students[0].comment).toBe('临时处理结果')
    expect(dataSourceStore.students[0].comment).toBeUndefined()
    expect(routerPush).not.toHaveBeenCalled()
  })
})
