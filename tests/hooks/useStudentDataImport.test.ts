import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

import { useStudentDataImport } from '../../src/hooks/useStudentDataImport'
import { useConfigurationStore } from '../../src/stores/configuration'
import { useDataSourceStore } from '../../src/stores/data-source'
import { useSettingStore } from '../../src/stores/setting'

/**
 * useStudentDataImport 组合式函数测试
 * 测试目标：首次/成绩/评语三类 Excel 导入的编排
 * 覆盖功能：文件选择触发与弹窗流转、首次导入写入 store、成绩列冲突检测与跳过、
 * 增量成绩导入、评语覆盖二次确认（确认/取消）、无数据防护与导入后路由跳转
 */

// 公共 Excel 预览状态：测试中通过 excelPreviewMocks.preview.value 注入预览数据
// 注意必须使用 Vue 的 shallowRef 包装，保证 hook 内 computed 能响应预览变化
const excelPreviewMocks = vi.hoisted(() => ({
  preview: { value: null } as { value: unknown },
  parseRawFile: vi.fn(),
  reset: vi.fn()
}))
vi.mock('@/hooks/useExcelPreviewImport', async () => {
  const { shallowRef } = await import('vue')
  const preview = shallowRef<{ rows: unknown[][]; merges: unknown[]; suggestedHeaderRowIndex: number } | null>(null)
  excelPreviewMocks.preview = preview
  return {
    useExcelPreviewImport: () => ({
      loading: shallowRef(false),
      preview,
      parseRawFile: excelPreviewMocks.parseRawFile,
      reset: excelPreviewMocks.reset
    })
  }
})

const routerMocks = vi.hoisted(() => ({
  replace: vi.fn().mockResolvedValue(undefined),
  currentRoute: { value: { path: '/overview' } }
}))
vi.mock('@/router', () => ({
  default: { replace: routerMocks.replace, currentRoute: routerMocks.currentRoute }
}))

const messageMocks = vi.hoisted(() => ({
  success: vi.fn(),
  warning: vi.fn(),
  error: vi.fn(),
  info: vi.fn()
}))
const messageBoxMocks = vi.hoisted(() => ({
  confirm: vi.fn()
}))
vi.mock('element-plus', () => ({
  ElMessage: messageMocks,
  ElMessageBox: messageBoxMocks
}))

describe('useStudentDataImport', () => {
  let hook: ReturnType<typeof useStudentDataImport>
  let dataSourceStore: ReturnType<typeof useDataSourceStore>
  let settingStore: ReturnType<typeof useSettingStore>
  let configurationStore: ReturnType<typeof useConfigurationStore>

  beforeEach(() => {
    setActivePinia(createPinia())
    dataSourceStore = useDataSourceStore()
    settingStore = useSettingStore()
    configurationStore = useConfigurationStore()
    // 让导入后的路由跳转等待立即完成
    dataSourceStore.isDataReady = true
    hook = useStudentDataImport()

    excelPreviewMocks.preview.value = null
    excelPreviewMocks.parseRawFile.mockReset().mockResolvedValue(true)
    excelPreviewMocks.reset.mockClear()
    routerMocks.replace.mockClear()
    routerMocks.currentRoute.value = { path: '/overview' }
    messageMocks.success.mockClear()
    messageMocks.warning.mockClear()
    messageMocks.error.mockClear()
    messageMocks.info.mockClear()
    messageBoxMocks.confirm.mockReset().mockResolvedValue('confirm')
  })

  const seedInitialImport = async (): Promise<void> => {
    excelPreviewMocks.preview.value = {
      rows: [['姓名', '语文'], ['张三', 90]],
      merges: [],
      suggestedHeaderRowIndex: 0
    }
    await hook.handleInitialConfirm({
      nameColumn: '姓名',
      scoreColumns: ['语文'],
      headerRowIndex: 0
    })
  }

  it('clicks the hidden file input when triggering an import', () => {
    const clickSpy = vi.fn()
    hook.excelFileInputRef.value = { click: clickSpy } as unknown as HTMLInputElement

    hook.triggerExcelImport('score')

    expect(clickSpy).toHaveBeenCalledTimes(1)
  })

  it('opens the initial dialog after parsing a file in initial mode', async () => {
    hook.excelFileInputRef.value = { click: vi.fn() } as unknown as HTMLInputElement
    hook.triggerExcelImport('initial')
    const file = new File(['x'], '名单.xlsx')
    const event = { target: { files: [file], value: 'C:\\fake\\名单.xlsx' } } as unknown as Event

    await hook.handleExcelFileChange(event)

    expect(excelPreviewMocks.parseRawFile).toHaveBeenCalledWith(file)
    expect(hook.initialDialogVisible.value).toBe(true)
    // input 值被清空，允许下次选择同一文件
    expect((event.target as HTMLInputElement).value).toBe('')
  })

  it('clears the input value and does nothing without a file', async () => {
    const event = { target: { files: [], value: 'C:\\fake\\x.xlsx' } } as unknown as Event

    await hook.handleExcelFileChange(event)

    expect((event.target as HTMLInputElement).value).toBe('')
    expect(hook.initialDialogVisible.value).toBe(false)
  })

  it('imports initial students and navigates to overview', async () => {
    routerMocks.currentRoute.value = { path: '/overview' }
    await seedInitialImport()

    expect(dataSourceStore.students).toHaveLength(1)
    expect(dataSourceStore.students[0].name).toBe('张三')
    expect(settingStore.scoreColumns).toHaveLength(1)
    expect(settingStore.scoreColumns[0].label).toBe('语文')
    expect(configurationStore.inputScoreTab).toBe(settingStore.scoreColumns[0].prop)
    expect(hook.initialDialogVisible.value).toBe(false)
    expect(messageMocks.success).toHaveBeenCalledWith('导入成功：1 名学生、1 个成绩列')
    expect(routerMocks.replace).toHaveBeenCalledWith('/overview')
  })

  it('reports an error when the selected header row yields no data', async () => {
    // 预览行存在但表头行为空时，header 解析结果为空
    excelPreviewMocks.preview.value = {
      rows: [[], ['张三']],
      merges: [],
      suggestedHeaderRowIndex: 0
    }

    await hook.handleInitialConfirm({ nameColumn: '姓名', scoreColumns: ['语文'] })

    expect(messageMocks.error).toHaveBeenCalledWith('Excel 中没有可导入的数据')
    expect(dataSourceStore.students).toHaveLength(0)
  })

  it('reports an error when the import yields no students', async () => {
    // 表头与数据均可解析，但数据行姓名为空，构建不出任何学生
    excelPreviewMocks.preview.value = {
      rows: [['姓名', '语文'], ['', 85]],
      merges: [],
      suggestedHeaderRowIndex: 0
    }

    await hook.handleInitialConfirm({ nameColumn: '姓名', scoreColumns: ['语文'] })

    expect(messageMocks.error).toHaveBeenCalledWith('没有可导入的学生数据')
    expect(dataSourceStore.students).toHaveLength(0)
  })

  it('detects conflicting score columns and opens the conflict dialog', async () => {
    settingStore.scoreColumns = [{ prop: 'yu3_wen2', label: '语文', type: 'number' }]
    excelPreviewMocks.preview.value = {
      rows: [['姓名', '语文'], ['张三', 90]],
      merges: [],
      suggestedHeaderRowIndex: 0
    }

    await hook.handleScoreColumnConfirm({
      nameColumn: '姓名',
      scoreColumns: ['语文'],
      headerRowIndex: 0
    })

    expect(hook.conflictColumns.value).toEqual(['语文'])
    expect(hook.conflictDialogVisible.value).toBe(true)
    expect(hook.scoreColumnSelectorVisible.value).toBe(false)
  })

  it('warns and resets when all conflicting columns are skipped', async () => {
    await seedInitialImport()
    hook.resetExcelImport()
    excelPreviewMocks.preview.value = {
      rows: [['姓名', '语文'], ['张三', 95]],
      merges: [],
      suggestedHeaderRowIndex: 0
    }
    await hook.handleScoreColumnConfirm({ nameColumn: '姓名', scoreColumns: ['语文'] })

    await hook.handleConflictConfirm({ 语文: 'skip' })

    expect(messageMocks.warning).toHaveBeenCalledWith('没有成绩列被导入')
    expect(hook.conflictDialogVisible.value).toBe(false)
    expect(settingStore.scoreColumns).toHaveLength(1)
  })

  it('imports a new score column and navigates to score page', async () => {
    await seedInitialImport()
    hook.resetExcelImport()
    routerMocks.currentRoute.value = { path: '/score' }
    excelPreviewMocks.preview.value = {
      rows: [['姓名', '数学'], ['张三', 88]],
      merges: [],
      suggestedHeaderRowIndex: 0
    }

    await hook.handleScoreColumnConfirm({ nameColumn: '姓名', scoreColumns: ['数学'] })

    expect(settingStore.scoreColumns.map((column) => column.label)).toEqual(['语文', '数学'])
    expect(messageMocks.success).toHaveBeenCalledWith(
      'Excel 成绩导入完成：新增 1 列，覆盖 0 列，跳过 0 列'
    )
    expect(routerMocks.replace).toHaveBeenCalledWith('/score')
  })

  it('warns when no name column is selected for score import', async () => {
    excelPreviewMocks.preview.value = {
      rows: [['姓名', '数学'], ['张三', 88]],
      merges: [],
      suggestedHeaderRowIndex: 0
    }

    await hook.handleScoreColumnConfirm({ scoreColumns: ['数学'] })

    expect(messageMocks.warning).toHaveBeenCalledWith('请选择姓名列')
  })

  it('imports comments with fill-empty strategy and navigates to comments page', async () => {
    await seedInitialImport()
    hook.resetExcelImport()
    routerMocks.currentRoute.value = { path: '/tools/comments' }
    excelPreviewMocks.preview.value = {
      rows: [['姓名', '评语'], ['张三', '表现优秀，继续保持']],
      merges: [],
      suggestedHeaderRowIndex: 0
    }

    await hook.handleCommentConfirm({
      nameColumn: '姓名',
      commentColumn: '评语',
      strategy: 'fill-empty',
      headerRowIndex: 0
    })

    expect(dataSourceStore.students[0].comment).toBe('表现优秀，继续保持')
    expect(messageMocks.success).toHaveBeenCalledWith('评语导入完成：新增 1 条，覆盖 0 条，跳过 0 条')
    expect(routerMocks.replace).toHaveBeenCalledWith('/tools/comments')
  })

  it('asks for confirmation before overwriting existing comments', async () => {
    await seedInitialImport()
    dataSourceStore.students[0].comment = '已有评语'
    hook.resetExcelImport()
    routerMocks.currentRoute.value = { path: '/tools/comments' }
    excelPreviewMocks.preview.value = {
      rows: [['姓名', '评语'], ['张三', '新的评语内容']],
      merges: [],
      suggestedHeaderRowIndex: 0
    }

    await hook.handleCommentConfirm({
      nameColumn: '姓名',
      commentColumn: '评语',
      strategy: 'overwrite',
      headerRowIndex: 0
    })

    expect(messageBoxMocks.confirm).toHaveBeenCalledWith(
      '将覆盖 1 名学生的已有评语，是否继续？',
      '确认覆盖评语',
      expect.objectContaining({ type: 'warning' })
    )
    expect(dataSourceStore.students[0].comment).toBe('新的评语内容')
  })

  it('aborts comment import when the overwrite confirmation is cancelled', async () => {
    await seedInitialImport()
    dataSourceStore.students[0].comment = '已有评语'
    hook.resetExcelImport()
    messageBoxMocks.confirm.mockRejectedValue('cancel')
    // 清除首次导入的成功提示，便于断言取消后没有新的导入成功提示
    messageMocks.success.mockClear()
    excelPreviewMocks.preview.value = {
      rows: [['姓名', '评语'], ['张三', '新的评语内容']],
      merges: [],
      suggestedHeaderRowIndex: 0
    }

    await hook.handleCommentConfirm({
      nameColumn: '姓名',
      commentColumn: '评语',
      strategy: 'overwrite',
      headerRowIndex: 0
    })

    expect(dataSourceStore.students[0].comment).toBe('已有评语')
    expect(messageMocks.success).not.toHaveBeenCalled()
  })

  it('reports an error when no comment row matches system students', async () => {
    dataSourceStore.students = []
    hook.resetExcelImport()
    excelPreviewMocks.preview.value = {
      rows: [['姓名', '评语'], ['李四', '评语内容']],
      merges: [],
      suggestedHeaderRowIndex: 0
    }

    await hook.handleCommentConfirm({
      nameColumn: '姓名',
      commentColumn: '评语',
      strategy: 'fill-empty',
      headerRowIndex: 0
    })

    expect(messageMocks.error).toHaveBeenCalledWith('Excel 中没有与系统学生匹配的姓名')
  })

  it('resets all import state', async () => {
    await seedInitialImport()
    hook.resetExcelImport()

    expect(hook.initialDialogVisible.value).toBe(false)
    expect(hook.scoreColumnSelectorVisible.value).toBe(false)
    expect(hook.commentDialogVisible.value).toBe(false)
    expect(hook.conflictDialogVisible.value).toBe(false)
    expect(hook.excelHeaders.value).toEqual([])
    expect(hook.excelRows.value).toEqual([])
    expect(hook.conflictColumns.value).toEqual([])
    expect(excelPreviewMocks.reset).toHaveBeenCalled()
  })
})
