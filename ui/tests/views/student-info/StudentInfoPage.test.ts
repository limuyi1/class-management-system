import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'

import StudentInfoPage from '@/views/student-info/StudentInfoPage.vue'

/**
 * StudentInfoPage 组件测试
 * 测试目标：学生信息页面壳
 * 覆盖功能：edit-tags 查询参数触发学生标签编辑器并清除查询参数、
 * return-to / return-student-id 查询参数透传给 StudentInfo 子组件、
 * 无参数时正常展示页面、缺少 student-id 时不触发编辑器
 */

const routerMocks = vi.hoisted(() => ({
  query: {} as Record<string, string | undefined>,
  replace: vi.fn().mockResolvedValue(undefined)
}))

vi.mock('vue-router', () => ({
  useRoute: () => ({ query: routerMocks.query }),
  useRouter: () => ({ replace: routerMocks.replace }),
  RouterView: { template: '<div />' }
}))

// StudentInfo 组件较重（vxe-table 等依赖），用轻量替身记录 openTagEditorById 调用
const studentInfoMocks = vi.hoisted(() => ({
  openTagEditorById: vi.fn()
}))

vi.mock('@/views/student-info/components/StudentInfoTable.vue', () => ({
  default: {
    name: 'StudentInfo',
    props: ['returnTo', 'returnStudentId'],
    template: '<div class="student-info-stub" />',
    methods: { openTagEditorById: studentInfoMocks.openTagEditorById }
  }
}))

describe('StudentInfoPage', () => {
  beforeEach(() => {
    routerMocks.query = {}
    routerMocks.replace.mockClear()
    studentInfoMocks.openTagEditorById.mockClear()
  })

  it('opens the tag editor from the edit-tags query and clears the query', async () => {
    routerMocks.query = { 'edit-tags': '1', 'student-id': 's1' }
    const wrapper = mount(StudentInfoPage)
    await flushPromises()

    expect(wrapper.get('.student-info-page').exists()).toBe(true)
    expect(wrapper.find('.student-info-stub').exists()).toBe(true)
    expect(studentInfoMocks.openTagEditorById).toHaveBeenCalledWith('s1')
    expect(routerMocks.replace).toHaveBeenCalledWith({ path: '/student-info' })
  })

  it('passes return navigation info from the query to StudentInfo', async () => {
    routerMocks.query = {
      'edit-tags': '1',
      'student-id': 's2',
      'return-to': '/tools/comments',
      'return-student-id': 's9'
    }
    const wrapper = mount(StudentInfoPage)
    await flushPromises()

    const child = wrapper.getComponent({ name: 'StudentInfo' })
    expect(child.props('returnTo')).toBe('/tools/comments')
    expect(child.props('returnStudentId')).toBe('s9')
  })

  it('renders normally without the edit-tags query', async () => {
    const wrapper = mount(StudentInfoPage)
    await flushPromises()

    expect(wrapper.get('.student-info-page').exists()).toBe(true)
    expect(wrapper.find('.student-info-stub').exists()).toBe(true)
    expect(studentInfoMocks.openTagEditorById).not.toHaveBeenCalled()
    expect(routerMocks.replace).not.toHaveBeenCalled()
    expect(wrapper.getComponent({ name: 'StudentInfo' }).props('returnTo')).toBe('')
  })

  it('ignores edit-tags without a valid student id', async () => {
    routerMocks.query = { 'edit-tags': '1' }
    mount(StudentInfoPage)
    await flushPromises()

    expect(studentInfoMocks.openTagEditorById).not.toHaveBeenCalled()
    expect(routerMocks.replace).not.toHaveBeenCalled()
  })
})
