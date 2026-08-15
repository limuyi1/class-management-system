import { computed, nextTick, ref } from 'vue'

import { storeToRefs } from 'pinia'
import { ElMessage, ElMessageBox } from 'element-plus'

import { useExcelPreviewImport } from '@/hooks/useExcelPreviewImport'
import router from '@/router'
import { useConfigurationStore } from '@/stores/configuration'
import { useDataSourceStore } from '@/stores/data-source'
import { useSettingStore } from '@/stores/setting'
import {
  buildIncrementalScoreImport,
  getConflictLabels
} from '@/utils/scoreImportUtil'
import { buildIncrementalCommentImport, countOverwrittenComments } from '@/utils/commentImportUtil'
import { buildInitialStudentImport } from '@/utils/initialStudentImportUtil'
import { buildExcelDataFromHeaderRow } from '@/utils/xlsxUtil'

import type { ConflictActionType, ExcelRowType } from '@/utils/scoreImportUtil'
import type {
  CommentImportSelectionType,
  ExcelImportModeType,
  InitialImportSelectionType
} from '@/types/StudentImport'

/**
 * 统一协调首次导入、增量成绩导入和增量评语导入。
 * 组件只负责展示弹窗；数据校验、写入、状态清理和导入后的路由都集中在这里。
 */
export const useStudentDataImport = () => {
  const dataSourceStore = useDataSourceStore()
  const settingStore = useSettingStore()
  const configurationStore = useConfigurationStore()
  const { students } = storeToRefs(dataSourceStore)
  const { scoreColumns } = storeToRefs(settingStore)

  const excelFileInputRef = ref<HTMLInputElement | null>(null)
  // 设置页保留 .dexie/Excel 共用的原生 input；Excel 解析状态统一交给公共 composable。
  const {
    loading: importingExcel,
    preview: excelPreview,
    parseRawFile,
    reset: resetExcelPreview
  } = useExcelPreviewImport({ errorLogLabel: '解析 Excel', errorMessage: '导入失败！' })
  const importMode = ref<ExcelImportModeType>('initial')
  const excelPreviewRows = computed(() => excelPreview.value?.rows ?? [])
  const excelPreviewMerges = computed(() => excelPreview.value?.merges ?? [])
  const suggestedHeaderRowIndex = computed(
    () => excelPreview.value?.suggestedHeaderRowIndex ?? 0
  )
  const excelHeaders = ref<string[]>([])
  const excelRows = ref<ExcelRowType[]>([])
  const initialDialogVisible = ref(false)
  const scoreColumnSelectorVisible = ref(false)
  const commentDialogVisible = ref(false)
  const conflictDialogVisible = ref(false)
  const pendingScoreColumns = ref<string[]>([])
  const pendingScoreNameColumn = ref('')
  const conflictColumns = ref<string[]>([])

  /** 重置 Excel 导入相关的所有临时状态 */
  const resetExcelImport = () => {
    initialDialogVisible.value = false
    scoreColumnSelectorVisible.value = false
    commentDialogVisible.value = false
    conflictDialogVisible.value = false
    resetExcelPreview()
    excelHeaders.value = []
    excelRows.value = []
    pendingScoreColumns.value = []
    pendingScoreNameColumn.value = ''
    conflictColumns.value = []
  }

  /**
   * 触发文件选择框，按指定模式导入
   * @param mode - 导入模式（首次/成绩/评语）
   */
  const triggerExcelImport = (mode: ExcelImportModeType) => {
    importMode.value = mode
    excelFileInputRef.value?.click()
  }

  /**
   * 导入完成后统一等待数据状态稳定，并校验目标路由是否真正生效。
   */
  const navigateAfterImport = async (targetPath: '/overview' | '/math' | '/comment') => {
    await nextTick()
    await dataSourceStore.waitForInitReady()

    try {
      await router.replace(targetPath)
      if (router.currentRoute.value.path !== targetPath) {
        console.error(`导入后跳转失败：期望 ${targetPath}，实际 ${router.currentRoute.value.path}`)
        ElMessage.error('导入成功，但页面跳转失败，请手动切换页面')
      }
    } catch (error) {
      console.error('导入后跳转失败:', error)
      ElMessage.error('导入成功，但页面跳转失败，请手动切换页面')
    }
  }

  /** 根据当前导入模式打开对应的弹窗 */
  const openModeDialog = () => {
    if (importMode.value === 'initial') {
      initialDialogVisible.value = true
      return
    }
    if (importMode.value === 'comment') {
      commentDialogVisible.value = true
    } else {
      scoreColumnSelectorVisible.value = true
    }
  }

  /**
   * 处理文件选择变化，解析成功后打开对应弹窗
   * @param event - 文件输入事件
   */
  const handleExcelFileChange = async (event: Event) => {
    const input = event.target as HTMLInputElement
    const file = input.files?.[0]
    input.value = ''
    if (!file) return

    if (await parseRawFile(file)) openModeDialog()
  }

  /**
   * 各业务弹窗内会选择表头行；真正写入前在这里统一生成 header/data，
   * 保证初始导入、成绩导入、评语导入使用同一套 Excel 行解析规则。
   */
  const applyHeaderRowSelection = (headerRowIndex?: number): boolean => {
    if (!excelPreviewRows.value.length) return true

    const { header, data } = buildExcelDataFromHeaderRow(
      excelPreviewRows.value,
      headerRowIndex ?? suggestedHeaderRowIndex.value
    )
    if (!header.length || !data.length) {
      ElMessage.error('Excel 中没有可导入的数据')
      return false
    }

    excelHeaders.value = header
    excelRows.value = data
    return true
  }

  /**
   * 确认首次导入，构建学生数据并写入 store
   * @param selection - 首次导入的选择配置（含表头行）
   */
  const handleInitialConfirm = async (
    selection: InitialImportSelectionType & { headerRowIndex?: number }
  ) => {
    if (!applyHeaderRowSelection(selection.headerRowIndex)) return

    const result = buildInitialStudentImport({
      rows: excelRows.value,
      ...selection
    })
    if (!result.students.length) {
      ElMessage.error('没有可导入的学生数据')
      return
    }

    scoreColumns.value = result.headers
    students.value = result.students
    configurationStore.inputScoreTab = result.headers[0]?.prop ?? null
    resetExcelImport()

    const summary = [`${result.students.length} 名学生`]
    if (result.headers.length) summary.push(`${result.headers.length} 个成绩列`)
    if (result.commentCount) summary.push(`${result.commentCount} 条评语`)
    if (result.duplicateStudentCount) {
      summary.push(`跳过 ${result.duplicateStudentCount} 条重名记录`)
    }
    ElMessage.success(`导入成功：${summary.join('、')}`)

    await navigateAfterImport('/overview')
  }

  /**
   * 执行成绩增量导入
   * @param conflictActions - 各冲突列的冲突处理策略
   */
  const applyScoreImport = async (conflictActions: Record<string, ConflictActionType>) => {
    const result = buildIncrementalScoreImport({
      rows: excelRows.value,
      existingStudents: students.value,
      existingHeaders: scoreColumns.value,
      nameColumn: pendingScoreNameColumn.value,
      selectedColumns: pendingScoreColumns.value,
      conflictActions
    })

    if (!result.stats.addedColumnCount && !result.stats.overwrittenColumnCount) {
      ElMessage.warning('没有成绩列被导入')
      resetExcelImport()
      return
    }

    scoreColumns.value = result.headers
    students.value = result.students
    const firstAppliedColumn = pendingScoreColumns.value.find(
      (column) => conflictActions[column] !== 'skip'
    )
    configurationStore.inputScoreTab =
      result.headers.find((header) => header.label === firstAppliedColumn)?.prop ??
      configurationStore.inputScoreTab

    const messages = [
      `新增 ${result.stats.addedColumnCount} 列`,
      `覆盖 ${result.stats.overwrittenColumnCount} 列`,
      `跳过 ${result.stats.skippedColumnCount} 列`
    ]
    if (result.stats.ignoredStudentCount) {
      messages.push(`忽略 ${result.stats.ignoredStudentCount} 名未匹配学生`)
    }
    if (result.stats.duplicateStudentCount) {
      messages.push(`跳过 ${result.stats.duplicateStudentCount} 条重名记录`)
    }
    if (result.stats.invalidScoreCount) {
      messages.push(`${result.stats.invalidScoreCount} 个成绩无法识别，已置为空`)
    }

    ElMessage.success(`Excel 成绩导入完成：${messages.join('，')}`)
    resetExcelImport()
    await navigateAfterImport('/math')
  }

  /**
   * 确认成绩列选择，检测冲突后执行成绩导入
   * @param selection - 姓名列、成绩列及表头行选择
   */
  const handleScoreColumnConfirm = async (selection: {
    nameColumn?: string
    scoreColumns: string[]
    headerRowIndex?: number
  }) => {
    if (!applyHeaderRowSelection(selection.headerRowIndex)) return

    if (!selection.nameColumn) {
      ElMessage.warning('请选择姓名列')
      return
    }

    pendingScoreNameColumn.value = selection.nameColumn
    pendingScoreColumns.value = selection.scoreColumns
    conflictColumns.value = getConflictLabels(selection.scoreColumns, scoreColumns.value)
    scoreColumnSelectorVisible.value = false

    if (conflictColumns.value.length) {
      conflictDialogVisible.value = true
      return
    }
    await applyScoreImport({})
  }

  /**
   * 确认评语导入，覆盖前二次确认后写入
   * @param selection - 评语导入的选择配置（含表头行）
   */
  const handleCommentConfirm = async (
    selection: CommentImportSelectionType & { headerRowIndex?: number }
  ) => {
    if (!applyHeaderRowSelection(selection.headerRowIndex)) return

    if (selection.strategy === 'overwrite') {
      const overwriteCount = countOverwrittenComments({
        rows: excelRows.value,
        existingStudents: students.value,
        ...selection
      })
      if (overwriteCount > 0) {
        try {
          await ElMessageBox.confirm(
            `将覆盖 ${overwriteCount} 名学生的已有评语，是否继续？`,
            '确认覆盖评语',
            {
              confirmButtonText: '继续导入',
              cancelButtonText: '取消',
              type: 'warning'
            }
          )
        } catch {
          return
        }
      }
    }

    const result = buildIncrementalCommentImport({
      rows: excelRows.value,
      existingStudents: students.value,
      ...selection
    })
    if (!result.stats.matchedStudentCount && !result.stats.duplicateStudentCount) {
      ElMessage.error('Excel 中没有与系统学生匹配的姓名')
      return
    }

    students.value = result.students
    const messages = [
      `新增 ${result.stats.filledCommentCount} 条`,
      `覆盖 ${result.stats.overwrittenCommentCount} 条`,
      `跳过 ${result.stats.skippedCommentCount} 条`
    ]
    if (result.stats.ignoredStudentCount) {
      messages.push(`忽略 ${result.stats.ignoredStudentCount} 名未匹配学生`)
    }
    if (result.stats.duplicateStudentCount) {
      messages.push(`跳过 ${result.stats.duplicateStudentCount} 条重名记录`)
    }

    ElMessage.success(`评语导入完成：${messages.join('，')}`)
    resetExcelImport()
    await navigateAfterImport('/comment')
  }

  return {
    excelFileInputRef,
    importingExcel,
    excelPreviewRows,
    excelPreviewMerges,
    suggestedHeaderRowIndex,
    excelHeaders,
    excelRows,
    initialDialogVisible,
    scoreColumnSelectorVisible,
    commentDialogVisible,
    conflictDialogVisible,
    conflictColumns,
    triggerExcelImport,
    handleExcelFileChange,
    handleInitialConfirm,
    handleScoreColumnConfirm,
    handleCommentConfirm,
    handleConflictConfirm: applyScoreImport,
    resetExcelImport
  }
}
