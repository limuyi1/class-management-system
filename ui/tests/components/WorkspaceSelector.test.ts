import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import ElementPlus, { ElDropdown } from 'element-plus'
import WorkspaceSelector from '@/components/workspace/WorkspaceSelector.vue'
import { switchWorkspace } from '@/utils/workspaceUtil'
import { confirmWorkspaceLeave } from '@/utils/workspaceSessionUtil'

const state = vi.hoisted(() => {
  const current = { id: 'current', classId: 'c1', className: '403班', termName: '本学期' }
  const previous = { ...current, id: 'previous', termName: '上学期' }
  const other = { id: 'other', classId: 'c2', className: '502班', termName: '本学期' }
  return {
    workspace: {
      activePeriod: current,
      activeClassPeriods: [previous, current],
      catalog: {
        classes: [
          { id: 'c1', lastPeriodId: 'current' },
          { id: 'c2', lastPeriodId: 'other' }
        ],
        periods: [previous, current, other]
      },
      snapshots: [],
      refresh: vi.fn()
    },
    server: { saving: false }
  }
})
vi.mock('@/stores/workspace', () => ({ useWorkspaceStore: () => state.workspace }))
vi.mock('@/repositories/v5StateRepository', () => ({ serverMode: true, serverState: state.server }))
vi.mock('@/utils/workspaceSessionUtil', () => ({
  confirmWorkspaceLeave: vi.fn(),
  getWorkspaceRevision: vi.fn()
}))
vi.mock('@/utils/workspaceUtil', () => ({
  switchWorkspace: vi.fn(),
  createWorkspace: vi.fn(),
  inheritWorkspaceSchedules: vi.fn(),
  deleteWorkspacePeriod: vi.fn(),
  renameWorkspace: vi.fn()
}))
vi.mock('@/db', () => ({ db: {}, DB_ID: 'main' }))

afterEach(() => {
  document.body.innerHTML = ''
})

beforeEach(() => {
  vi.clearAllMocks()
  state.server.saving = false
  vi.mocked(confirmWorkspaceLeave).mockResolvedValue(false)
})
it('顶部只显示当前工作区入口，下拉按班级提供各学期和统一管理入口', async () => {
  const wrapper = mount(WorkspaceSelector, {
    attachTo: document.body,
    global: { plugins: [ElementPlus] }
  })
  expect(wrapper.get('.workspace-selector__trigger').text()).toBe('403班 · 本学期')
  expect(wrapper.find('.el-select').exists()).toBe(false)
  await wrapper.get('.workspace-selector__trigger').trigger('click')
  await flushPromises()
  expect(
    Array.from(document.querySelectorAll('.workspace-selector__group')).map(
      (item) => item.textContent
    )
  ).toEqual(['403班', '502班'])
  expect(document.querySelector('.workspace-selector__menu')?.textContent).toContain('上学期')
  expect(document.querySelector('.workspace-selector__menu')?.textContent).toContain(
    '班级与学期管理'
  )
  wrapper.unmount()
})
it('切换继续遵循草稿和提交保护，当前学期不重复切换', async () => {
  const wrapper = mount(WorkspaceSelector, {
    attachTo: document.body,
    global: { plugins: [ElementPlus] }
  })
  const dropdown = wrapper.findComponent(ElDropdown)
  dropdown.vm.$emit('command', 'current')
  await flushPromises()
  expect(confirmWorkspaceLeave).not.toHaveBeenCalled()
  dropdown.vm.$emit('command', 'previous')
  await flushPromises()
  expect(confirmWorkspaceLeave).toHaveBeenCalledOnce()
  expect(switchWorkspace).not.toHaveBeenCalled()
  state.server.saving = true
  dropdown.vm.$emit('command', 'other')
  await flushPromises()
  expect(confirmWorkspaceLeave).toHaveBeenCalledOnce()
  expect(switchWorkspace).not.toHaveBeenCalled()
  dropdown.vm.$emit('command', 'manage')
  await flushPromises()
  expect(
    Array.from(document.querySelectorAll('.el-dialog')).some((dialog) =>
      dialog.textContent?.includes('班级与学期管理')
    )
  ).toBe(true)
  wrapper.unmount()
})

it('选择另一个班级的学期后保存并切换，重新加载工作台', async () => {
  vi.mocked(confirmWorkspaceLeave).mockResolvedValue(true)
  const reload = vi.spyOn(window.location, 'reload').mockImplementation(() => {})
  const wrapper = mount(WorkspaceSelector, {
    attachTo: document.body,
    global: { plugins: [ElementPlus] }
  })
  wrapper.findComponent(ElDropdown).vm.$emit('command', 'other')
  await flushPromises()
  expect(switchWorkspace).toHaveBeenCalledWith('other')
  expect(reload).toHaveBeenCalledOnce()
  wrapper.unmount()
  reload.mockRestore()
})
