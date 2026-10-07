import { defineComponent, ref } from 'vue'
import { enableAutoUnmount, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// 每个用例后自动卸载宿主组件，避免 beforeunload 监听器跨用例残留
enableAutoUnmount(afterEach)

import { useEvaluationCommentSource } from '@/views/evaluation/composables/useEvaluationCommentSource'

import type { StudentDataType } from '@/types/StudentData'
import type { TagCategoryType } from '@/types/Setting'

/**
 * useEvaluationCommentSource 组合式函数测试
 * 测试目标：期末评语数据源切换（系统学生 / Excel 临时数据）
 * 覆盖功能：默认系统源、Excel 载入与导出、源切换时的未导出修改拦截、
 * 首次进入 Excel 源弹导入框、浏览器刷新拦截与路由离开守卫
 */

// 路由离开守卫替身：捕获守卫回调供测试手动触发
const routerMocks = vi.hoisted(() => ({
  onBeforeRouteLeave: vi.fn()
}))
vi.mock('vue-router', () => ({
  onBeforeRouteLeave: routerMocks.onBeforeRouteLeave
}))

const messageMocks = vi.hoisted(() => ({
  success: vi.fn(),
  warning: vi.fn(),
  error: vi.fn()
}))
const messageBoxMocks = vi.hoisted(() => ({
  confirm: vi.fn()
}))
vi.mock('element-plus', () => ({
  ElMessage: messageMocks,
  ElMessageBox: messageBoxMocks
}))

const excelUtilMocks = vi.hoisted(() => ({
  exportExcelCommentWorkspace: vi.fn()
}))
vi.mock('@/utils/evaluation/commentWorkspaceExcelUtil', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/utils/evaluation/commentWorkspaceExcelUtil')>()
  return {
    ...actual,
    exportExcelCommentWorkspace: excelUtilMocks.exportExcelCommentWorkspace
  }
})

/** 系统学生与标签分类 fixture */
const createSystemStudent = (studentId: string, name: string): StudentDataType => ({
  studentId,
  name
})
const systemStudents: StudentDataType[] = [
  createSystemStudent('s1', '张三'),
  createSystemStudent('s2', '李四')
]
const systemTagCategories: TagCategoryType[] = [
  { prop: 'xue2_xi2', label: '学习习惯' }
]

/** Excel 临时工作区 fixture */
const createExcelWorkspace = () => ({
  fileName: '临时评语.xlsx',
  nameColumn: '姓名',
  commentColumn: '评语',
  students: [
    { studentId: 'e1', name: '王五', comment: '表现良好' },
    { studentId: 'e2', name: '赵六', comment: '' }
  ],
  skippedEmptyNameCount: 0
})

/** 挂载宿主组件并暴露组合式函数返回值 */
const mountSource = () => {
  let exposed: ReturnType<typeof useEvaluationCommentSource> | undefined
  const Component = defineComponent({
    setup() {
      exposed = useEvaluationCommentSource({
        systemStudents: ref(systemStudents),
        systemTagCategories: ref(systemTagCategories)
      })
    },
    template: '<div />'
  })
  const wrapper = mount(Component)
  return {
    wrapper,
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    getState: () => exposed!
  }
}

describe('useEvaluationCommentSource', () => {
  beforeEach(() => {
    routerMocks.onBeforeRouteLeave.mockReset()
    messageMocks.success.mockClear()
    messageMocks.warning.mockClear()
    messageMocks.error.mockClear()
    messageBoxMocks.confirm.mockReset().mockResolvedValue('confirm')
    excelUtilMocks.exportExcelCommentWorkspace.mockReset().mockResolvedValue(undefined)
  })

  it('defaults to the system source with system students and tag categories', () => {
    const { getState } = mountSource()
    const state = getState()

    expect(state.source.value).toBe('system')
    expect(state.students.value).toEqual(systemStudents)
    expect(state.allowTagEditing.value).toBe(true)
    expect(state.tagCategories.value).toEqual(systemTagCategories)
  })

  it('loads an Excel workspace and switches to the excel source', async () => {
    const { getState } = mountSource()
    const state = getState()

    state.handleExcelImport(createExcelWorkspace())

    expect(state.source.value).toBe('excel')
    expect(state.students.value).toHaveLength(2)
    expect(state.allowTagEditing.value).toBe(false)
    expect(state.tagCategories.value).toEqual([{ prop: '__excel_comment_tags', label: '临时标签' }])
    expect(state.excelFileName.value).toBe('临时评语.xlsx')
    expect(state.excelStudentCount.value).toBe(2)
    expect(messageMocks.success).toHaveBeenCalledWith('已载入 2 条临时学生数据')
  })

  it('warns about skipped empty-name rows during import', () => {
    const { getState } = mountSource()

    getState().handleExcelImport({ ...createExcelWorkspace(), skippedEmptyNameCount: 3 })

    expect(messageMocks.warning).toHaveBeenCalledWith('已跳过 3 行空姓名数据')
  })

  it('opens the import dialog on first switch to excel without changing source', async () => {
    const { getState } = mountSource()
    const state = getState()

    await state.handleSourceChange('excel')

    expect(state.importDialogVisible.value).toBe(true)
    expect(state.source.value).toBe('system')
  })

  it('switches back to system and clears the workspace when there are no changes', async () => {
    const { getState } = mountSource()
    const state = getState()
    state.handleExcelImport(createExcelWorkspace())

    await state.handleSourceChange('system')

    expect(state.source.value).toBe('system')
    expect(state.students.value).toEqual(systemStudents)
    expect(state.excelFileName.value).toBe('')
  })

  it('blocks leaving the excel source when unexported changes exist and user cancels', async () => {
    const { getState } = mountSource()
    const state = getState()
    state.handleExcelImport(createExcelWorkspace())
    // 修改后不导出，形成未导出修改
    state.students.value[0].comment = '修改后的评语'
    messageBoxMocks.confirm.mockRejectedValue('cancel')

    await state.handleSourceChange('system')

    expect(messageBoxMocks.confirm).toHaveBeenCalled()
    expect(state.source.value).toBe('excel')
  })

  it('leaves the excel source when the user confirms discarding changes', async () => {
    const { getState } = mountSource()
    const state = getState()
    state.handleExcelImport(createExcelWorkspace())
    state.students.value[0].comment = '修改后的评语'

    await state.handleSourceChange('system')

    expect(state.source.value).toBe('system')
    expect(state.excelFileName.value).toBe('')
  })

  it('exports the workspace and syncs the exported snapshot', async () => {
    const { getState } = mountSource()
    const state = getState()
    state.handleExcelImport(createExcelWorkspace())
    state.students.value[0].comment = '修改后的评语'

    await state.handleExcelExport()

    expect(excelUtilMocks.exportExcelCommentWorkspace).toHaveBeenCalled()
    expect(messageMocks.success).toHaveBeenCalledWith('评语 Excel 导出成功')
    // 导出后修改快照已同步，不再视为未导出修改
    await state.handleSourceChange('system')
    expect(messageBoxMocks.confirm).not.toHaveBeenCalled()
    expect(state.source.value).toBe('system')
  })

  it('warns when exporting without a workspace', async () => {
    const { getState } = mountSource()

    await getState().handleExcelExport()

    expect(messageMocks.warning).toHaveBeenCalledWith('请先上传 Excel 文件')
    expect(excelUtilMocks.exportExcelCommentWorkspace).not.toHaveBeenCalled()
  })

  it('shows an error message when the export fails', async () => {
    excelUtilMocks.exportExcelCommentWorkspace.mockRejectedValue(new Error('导出失败'))
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { getState } = mountSource()
    getState().handleExcelImport(createExcelWorkspace())

    await getState().handleExcelExport()

    expect(messageMocks.error).toHaveBeenCalledWith('导出失败')
    consoleSpy.mockRestore()
  })

  it('intercepts beforeunload only when unexported changes exist', () => {
    const { getState, wrapper } = mountSource()
    const state = getState()

    const dispatchBeforeUnload = (): Event => {
      const event = new Event('beforeunload')
      Object.defineProperty(event, 'preventDefault', { value: vi.fn() })
      Object.defineProperty(event, 'returnValue', { value: undefined, writable: true })
      window.dispatchEvent(event)
      return event
    }

    // 无修改时不拦截
    let event = dispatchBeforeUnload()
    expect((event as Event & { preventDefault: ReturnType<typeof vi.fn> }).preventDefault).not.toHaveBeenCalled()

    // 有未导出修改时拦截
    state.handleExcelImport(createExcelWorkspace())
    state.students.value[0].comment = '修改后的评语'
    event = dispatchBeforeUnload()
    expect((event as Event & { preventDefault: ReturnType<typeof vi.fn> }).preventDefault).toHaveBeenCalled()

    // 卸载后移除监听，不再拦截
    wrapper.unmount()
    event = dispatchBeforeUnload()
    expect((event as Event & { preventDefault: ReturnType<typeof vi.fn> }).preventDefault).not.toHaveBeenCalled()
  })

  it('registers a route leave guard that validates unexported changes', async () => {
    const { getState } = mountSource()
    const state = getState()
    const guard = routerMocks.onBeforeRouteLeave.mock.calls[0][0] as () => Promise<boolean>

    // 无修改时直接放行
    await expect(guard()).resolves.toBe(true)

    // 有未导出修改且用户取消时阻止离开
    state.handleExcelImport(createExcelWorkspace())
    state.students.value[0].comment = '修改后的评语'
    messageBoxMocks.confirm.mockRejectedValue('cancel')
    await expect(guard()).resolves.toBe(false)

    // 用户确认后放行
    messageBoxMocks.confirm.mockResolvedValue('confirm')
    await expect(guard()).resolves.toBe(true)
  })
})
