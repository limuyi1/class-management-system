/**
 * useEvaluationInput 组合式函数测试
 * 覆盖：从评语编辑器编辑标签时跳转独立学生信息页（携带编辑标签与返回参数）、
 * 编辑临时 Excel 行时不写入系统数据源且不跳转标签编辑页。
 */

import { defineComponent, nextTick, ref } from 'vue'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useEvaluationInput } from '../../src/hooks/useEvaluationInput'
import { useDataSourceStore } from '../../src/stores/data-source'
import { NAME_PROP } from '../../src/constants'

// 记录 vue-router push 调用，用于断言路由跳转的参数
const routerPush = vi.fn()

// mock vue-router，避免测试依赖真实路由实例
vi.mock('vue-router', () => ({
  useRouter: () => ({
    push: routerPush
  })
}))

// 测试宿主组件：模拟评语编辑器场景，内部只挂载 hook 并以 input 暴露其返回值
const Harness = defineComponent({
  setup() {
    const input = useEvaluationInput({
      onScroll: vi.fn()
    })

    return { input }
  },
  template: '<div />'
})

// 临时数据宿主组件：模拟外班 Excel 临时学生行（studentId 以 excel: 开头）、临时标签且禁止编辑标签
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

// 目标：验证编辑与标签跳转时对系统 store 写入、路由跳转的边界行为
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
