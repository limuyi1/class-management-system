import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'

/**
 * ImportExport 组件测试
 * 测试目标：设置页数据导入导出面板
 * 覆盖功能：备份状态展示（从未备份/逾期/近期）、导出按钮触发备份导出与进度流转、
 * 恢复备份的文件选择与确认导入/取消确认、清空数据的确认流程、
 * Excel 导入菜单事件与文件选择事件转发、hasStudentData 文案与菜单切换
 * 说明：备份工具、Excel 导入 hook、路由、ElMessageBox 均为 mock，
 * 本文件聚焦组件自身的交互编排与状态流转
 */

// 备份工具 mock：进度回调与完成回调由测试控制
const backupMocks = vi.hoisted(() => ({
  getDaysSinceBackup: vi.fn(() => 3),
  exportDatabase: vi.fn(),
  importDatabase: vi.fn(),
  clearDatabase: vi.fn()
}))
vi.mock('@/utils/backup', () => backupMocks)

// Excel 导入 hook mock：组件只负责转发，导入编排逻辑在 hook 内（另有专门测试）
const importHookMocks = vi.hoisted(() => ({
  triggerExcelImport: vi.fn(),
  handleExcelFileChange: vi.fn(),
  handleInitialConfirm: vi.fn(),
  handleScoreColumnConfirm: vi.fn(),
  handleConflictConfirm: vi.fn(),
  resetExcelImport: vi.fn()
}))
vi.mock('@/hooks/useStudentDataImport', async () => {
  const { ref } = await import('vue')
  return {
    useStudentDataImport: () => ({
      excelFileInputRef: ref(null),
      importingExcel: ref(false),
      excelPreviewRows: ref([]),
      excelPreviewMerges: ref([]),
      suggestedHeaderRowIndex: ref(0),
      excelHeaders: ref([]),
      excelRows: ref([]),
      initialDialogVisible: ref(false),
      scoreColumnSelectorVisible: ref(false),
      conflictDialogVisible: ref(false),
      conflictColumns: ref([]),
      ...importHookMocks
    })
  }
})

const routerMocks = vi.hoisted(() => ({
  push: vi.fn().mockResolvedValue(undefined),
  replace: vi.fn().mockResolvedValue(undefined),
  currentRoute: { value: { path: '/setting' } }
}))
vi.mock('@/router', () => ({
  default: {
    push: routerMocks.push,
    replace: routerMocks.replace,
    currentRoute: routerMocks.currentRoute
  }
}))

const routeQueryMocks = vi.hoisted(() => ({
  query: {} as Record<string, string | undefined>
}))
vi.mock('vue-router', () => ({
  useRoute: () => ({ query: routeQueryMocks.query }),
  RouterView: { template: '<div />' }
}))

const messageBoxMocks = vi.hoisted(() => ({ confirm: vi.fn() }))
vi.mock('element-plus', async (importOriginal) => {
  const actual = await importOriginal<typeof import('element-plus')>()
  return { ...actual, ElMessageBox: messageBoxMocks }
})

import ImportExport from '@/views/setting/components/ImportExport.vue'
import { useConfigurationStore } from '@/stores/configuration'
import { useDataSourceStore } from '@/stores/data-source'

const mountComponent = () =>
  mount(ImportExport, {
    global: {
      stubs: {
        ElCard: { template: '<div class="el-card"><slot /></div>' },
        ElButton: { template: '<button type="button"><slot /><slot name="icon" /></button>' },
        ElDivider: true,
        // 需要断言 props 的替身显式声明对应 props
        ImportProgress: {
          props: ['visible', 'title', 'percent'],
          template: '<div class="import-progress-stub" />'
        },
        ImportActionMenu: {
          props: ['hasStudentData', 'loading'],
          template: '<div class="import-action-menu-stub" />'
        },
        InitialImportDialog: true,
        ExcelColumnSelector: true,
        ExcelColumnConflictDialog: true
      }
    }
  })

const waitForDialogClose = () => new Promise((resolve) => setTimeout(resolve, 600))

describe('ImportExport', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    backupMocks.getDaysSinceBackup.mockReset().mockReturnValue(3)
    backupMocks.exportDatabase.mockReset()
    backupMocks.importDatabase.mockReset()
    backupMocks.clearDatabase.mockReset()
    importHookMocks.triggerExcelImport.mockClear()
    importHookMocks.handleExcelFileChange.mockClear()
    routerMocks.push.mockClear()
    routerMocks.replace.mockClear()
    routeQueryMocks.query = {}
    messageBoxMocks.confirm.mockReset().mockResolvedValue('confirm')
  })

  it('shows the overdue status when never backed up', () => {
    const wrapper = mountComponent()

    const status = wrapper.get('.backup-status')
    expect(status.classes()).toContain('is-overdue')
    expect(status.text()).toContain('从未备份，建议尽快备份')
  })

  it('shows the days-since-backup overdue status', () => {
    const configurationStore = useConfigurationStore()
    configurationStore.lastBackupAt = '2026-08-30T08:00:00'
    backupMocks.getDaysSinceBackup.mockReturnValue(8)

    const wrapper = mountComponent()

    const status = wrapper.get('.backup-status')
    expect(status.classes()).toContain('is-overdue')
    expect(status.text()).toContain('上次备份 8 天前，建议尽快备份')
  })

  it('shows the last backup time for a recent backup', () => {
    const configurationStore = useConfigurationStore()
    configurationStore.lastBackupAt = '2026-09-07T08:00:00'
    backupMocks.getDaysSinceBackup.mockReturnValue(2)

    const wrapper = mountComponent()

    const status = wrapper.get('.backup-status')
    expect(status.classes()).not.toContain('is-overdue')
    expect(status.text()).toContain('上次备份：2026-09-07')
  })

  it('exports the full backup and drives the progress dialog to completion', async () => {
    let resolveExport!: () => void
    backupMocks.exportDatabase.mockImplementationOnce(
      (onProgress?: (percent: number) => void) => {
        onProgress?.(40)
        return new Promise<void>((resolve) => {
          resolveExport = resolve
        })
      }
    )

    const wrapper = mountComponent()
    const exportButton = wrapper.findAll('button').find((button) => button.text() === '导出')
    expect(exportButton).toBeTruthy()
    await exportButton!.trigger('click')
    await flushPromises()

    expect(backupMocks.exportDatabase).toHaveBeenCalledWith(expect.any(Function))
    const progress = wrapper.getComponent({ name: 'ImportProgress' })
    expect(progress.props('visible')).toBe(true)
    expect(progress.props('title')).toBe('正在导出数据')
    expect(progress.props('percent')).toBe(40)

    resolveExport()
    await flushPromises()
    expect(progress.props('percent')).toBe(100)

    // 完成态展示 500ms 后自动关闭
    await waitForDialogClose()
    expect(progress.props('visible')).toBe(false)
  })

  it('opens the file picker when choosing a backup', () => {
    const wrapper = mountComponent()

    const input = wrapper.get('input[accept=".dexie"]').element as HTMLInputElement
    const clickSpy = vi.spyOn(input, 'click').mockImplementation(() => {})
    const chooseButton = wrapper.findAll('button').find((button) => button.text() === '选择备份')
    expect(chooseButton).toBeTruthy()
    chooseButton!.trigger('click')

    expect(clickSpy).toHaveBeenCalledTimes(1)
  })

  it('imports a backup file after confirmation and navigates to overview', async () => {
    backupMocks.importDatabase.mockImplementationOnce(
      (file: File, onProgress?: (percent: number) => void, complete?: () => void) => {
        onProgress?.(60)
        complete?.()
        return Promise.resolve()
      }
    )

    const wrapper = mountComponent()
    const input = wrapper.get('input[accept=".dexie"]')
    const file = new File(['data'], 'backup.dexie')
    Object.defineProperty(input.element, 'files', { value: [file], configurable: true })
    await input.trigger('change')
    await flushPromises()

    expect(messageBoxMocks.confirm).toHaveBeenCalledWith(
      '导入将覆盖当前所有数据，确定要继续吗？',
      '确认导入',
      expect.objectContaining({ type: 'warning' })
    )
    expect(backupMocks.importDatabase).toHaveBeenCalledWith(
      file,
      expect.any(Function),
      expect.any(Function)
    )
    const progress = wrapper.getComponent({ name: 'ImportProgress' })
    expect(progress.props('visible')).toBe(true)
    expect(progress.props('title')).toBe('正在导入数据')
    expect(progress.props('percent')).toBe(100)

    await waitForDialogClose()
    expect(routerMocks.push).toHaveBeenCalledWith('/overview')
    expect(progress.props('visible')).toBe(false)
  })

  it('aborts backup import when the confirmation is cancelled', async () => {
    messageBoxMocks.confirm.mockRejectedValueOnce('cancel')

    const wrapper = mountComponent()
    const input = wrapper.get('input[accept=".dexie"]')
    Object.defineProperty(input.element, 'files', {
      value: [new File(['x'], 'backup.dexie')],
      configurable: true
    })
    await input.trigger('change')
    await flushPromises()

    expect(backupMocks.importDatabase).not.toHaveBeenCalled()
    expect(wrapper.getComponent({ name: 'ImportProgress' }).props('visible')).toBe(false)
  })

  it('clears all data after confirmation and navigates to tools', async () => {
    let callComplete!: () => void
    backupMocks.clearDatabase.mockImplementationOnce(
      (onProgress?: (percent: number) => void, complete?: () => void) => {
        onProgress?.(50)
        callComplete = complete!
        return Promise.resolve()
      }
    )

    const wrapper = mountComponent()
    const clearButton = wrapper.findAll('button').find((button) => button.text() === '清空')
    expect(clearButton).toBeTruthy()
    await clearButton!.trigger('click')
    await flushPromises()

    expect(messageBoxMocks.confirm).toHaveBeenCalledWith(
      '确定要清空所有数据吗？此操作不可恢复！',
      '确认清空',
      expect.objectContaining({ type: 'error' })
    )
    expect(backupMocks.clearDatabase).toHaveBeenCalledWith(
      expect.any(Function),
      expect.any(Function)
    )
    const progress = wrapper.getComponent({ name: 'ImportProgress' })
    expect(progress.props('title')).toBe('正在清空数据')
    expect(progress.props('percent')).toBe(50)
    expect(progress.props('visible')).toBe(true)

    callComplete()
    await flushPromises()
    expect(routerMocks.push).toHaveBeenCalledWith('/tools')
    expect(progress.props('visible')).toBe(false)
  })

  it('forwards excel import menu events to the import hook', async () => {
    const wrapper = mountComponent()
    const menu = wrapper.getComponent({ name: 'ImportActionMenu' })

    menu.vm.$emit('initial')
    await wrapper.vm.$nextTick()
    expect(importHookMocks.triggerExcelImport).toHaveBeenCalledWith('initial')

    menu.vm.$emit('score')
    await wrapper.vm.$nextTick()
    expect(importHookMocks.triggerExcelImport).toHaveBeenCalledWith('score')
  })

  it('forwards excel file selection to the import hook', async () => {
    const wrapper = mountComponent()

    await wrapper.get('input[accept=".xls,.xlsx"]').trigger('change')

    expect(importHookMocks.handleExcelFileChange).toHaveBeenCalledTimes(1)
    expect(importHookMocks.handleExcelFileChange).toHaveBeenCalledWith(expect.any(Event))
  })

  it('switches the excel action description and menu props by student data presence', () => {
    const dataSourceStore = useDataSourceStore()

    const emptyWrapper = mountComponent()
    expect(emptyWrapper.text()).toContain('批量建立系统学生名单，可同时选择成绩列和评语列')
    expect(
      emptyWrapper.getComponent({ name: 'ImportActionMenu' }).props('hasStudentData')
    ).toBe(false)

    dataSourceStore.students = [{ studentId: 's1', name: '张三' }]
    const seededWrapper = mountComponent()
    expect(seededWrapper.text()).toContain('按姓名匹配现有学生并追加成绩，不新增系统学生')
    expect(
      seededWrapper.getComponent({ name: 'ImportActionMenu' }).props('hasStudentData')
    ).toBe(true)
  })
})
