import { nextTick, ref } from 'vue'

import { storeToRefs } from 'pinia'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { UploadFile } from 'element-plus'

import router from '@/router'
import { useConfigurationStore } from '@/stores/configuration'
import { useDataSourceStore } from '@/stores/data-source'
import { useSettingStore } from '@/stores/setting'
import {
  buildIncrementalScoreImport,
  findDuplicateNames,
  getConflictLabels
} from '@/utils/scoreImportUntil'
import { buildIncrementalCommentImport, countOverwrittenComments } from '@/utils/commentImportUntil'
import { buildInitialStudentImport } from '@/utils/initialStudentImportUntil'
import { parseExcel } from '@/utils/xlsxUntil'
import { NAME_PROP } from '@/types/Constants'

import type { ConflictActionType, ExcelRowType } from '@/utils/scoreImportUntil'
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
  const { items } = storeToRefs(dataSourceStore)
  const { tableHeaders } = storeToRefs(settingStore)

  const excelFileInputRef = ref<HTMLInputElement | null>(null)
  const importingExcel = ref(false)
  const importMode = ref<ExcelImportModeType>('initial')
  const excelHeaders = ref<string[]>([])
  const excelRows = ref<ExcelRowType[]>([])
  const initialDialogVisible = ref(false)
  const scoreColumnSelectorVisible = ref(false)
  const commentDialogVisible = ref(false)
  const conflictDialogVisible = ref(false)
  const pendingScoreColumns = ref<string[]>([])
  const conflictColumns = ref<string[]>([])

  const resetExcelImport = () => {
    initialDialogVisible.value = false
    scoreColumnSelectorVisible.value = false
    commentDialogVisible.value = false
    conflictDialogVisible.value = false
    excelHeaders.value = []
    excelRows.value = []
    pendingScoreColumns.value = []
    conflictColumns.value = []
  }

  const triggerExcelImport = (mode: ExcelImportModeType) => {
    importMode.value = mode
    excelFileInputRef.value?.click()
  }

  const validateSystemNames = (): boolean => {
    const duplicateNames = findDuplicateNames(items.value, NAME_PROP)
    if (!duplicateNames.length) return true

    ElMessage.error(`系统中存在重复姓名：${duplicateNames.slice(0, 3).join('、')}`)
    return false
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

  const openModeDialog = () => {
    if (importMode.value === 'initial') {
      initialDialogVisible.value = true
      return
    }
    if (!validateSystemNames()) return

    if (importMode.value === 'comment') {
      commentDialogVisible.value = true
    } else {
      scoreColumnSelectorVisible.value = true
    }
  }

  const handleExcelFileChange = async (event: Event) => {
    const input = event.target as HTMLInputElement
    const file = input.files?.[0]
    input.value = ''
    if (!file) return

    importingExcel.value = true
    try {
      const { header, data } = await parseExcel({ raw: file } as UploadFile)
      if (!header.length || !data.length) {
        ElMessage.error('Excel 中没有可导入的数据')
        return
      }

      // 现有成绩导入保持原约束，避免本次新增评语功能改变既有使用习惯。
      if (importMode.value === 'score' && !header.includes('姓名')) {
        ElMessage.error('添加成绩时，Excel 必须包含[姓名]列')
        return
      }

      excelHeaders.value = header
      excelRows.value = data
      openModeDialog()
    } catch (error) {
      console.error('解析 Excel 失败:', error)
      ElMessage.error('导入失败！')
    } finally {
      importingExcel.value = false
    }
  }

  const handleInitialConfirm = async (selection: InitialImportSelectionType) => {
    const duplicateNames = findDuplicateNames(excelRows.value, selection.nameColumn)
    if (duplicateNames.length) {
      ElMessage.error(`Excel 中存在重复姓名：${duplicateNames.slice(0, 3).join('、')}`)
      return
    }

    const result = buildInitialStudentImport({
      rows: excelRows.value,
      ...selection
    })
    if (!result.students.length) {
      ElMessage.error('没有可导入的学生数据')
      return
    }

    tableHeaders.value = result.headers
    items.value = result.students
    configurationStore.inputScoreTab = result.headers[0]?.prop ?? null
    resetExcelImport()

    const summary = [`${result.students.length} 名学生`]
    if (result.headers.length) summary.push(`${result.headers.length} 个成绩列`)
    if (result.commentCount) summary.push(`${result.commentCount} 条评语`)
    ElMessage.success(`导入成功：${summary.join('、')}`)

    await navigateAfterImport('/overview')
  }

  const applyScoreImport = async (conflictActions: Record<string, ConflictActionType>) => {
    const result = buildIncrementalScoreImport({
      rows: excelRows.value,
      existingStudents: items.value,
      existingHeaders: tableHeaders.value,
      selectedColumns: pendingScoreColumns.value,
      conflictActions
    })

    if (!result.stats.addedColumnCount && !result.stats.overwrittenColumnCount) {
      ElMessage.warning('没有成绩列被导入')
      resetExcelImport()
      return
    }

    tableHeaders.value = result.headers
    items.value = result.students
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
    if (result.stats.invalidScoreCount) {
      messages.push(`${result.stats.invalidScoreCount} 个成绩无法识别，已置为空`)
    }

    ElMessage.success(`Excel 成绩导入完成：${messages.join('，')}`)
    resetExcelImport()
    await navigateAfterImport('/math')
  }

  const handleScoreColumnConfirm = async (selection: { scoreColumns: string[] }) => {
    const duplicateNames = findDuplicateNames(excelRows.value, '姓名')
    if (duplicateNames.length) {
      ElMessage.error(`Excel 中存在重复姓名：${duplicateNames.slice(0, 3).join('、')}`)
      return
    }

    pendingScoreColumns.value = selection.scoreColumns
    conflictColumns.value = getConflictLabels(selection.scoreColumns, tableHeaders.value)
    scoreColumnSelectorVisible.value = false

    if (conflictColumns.value.length) {
      conflictDialogVisible.value = true
      return
    }
    await applyScoreImport({})
  }

  const handleCommentConfirm = async (selection: CommentImportSelectionType) => {
    const duplicateNames = findDuplicateNames(excelRows.value, selection.nameColumn)
    if (duplicateNames.length) {
      ElMessage.error(`Excel 中存在重复姓名：${duplicateNames.slice(0, 3).join('、')}`)
      return
    }

    if (selection.strategy === 'overwrite') {
      const overwriteCount = countOverwrittenComments({
        rows: excelRows.value,
        existingStudents: items.value,
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
      existingStudents: items.value,
      ...selection
    })
    if (!result.stats.matchedStudentCount) {
      ElMessage.error('Excel 中没有与系统学生匹配的姓名')
      return
    }

    items.value = result.students
    const messages = [
      `新增 ${result.stats.filledCommentCount} 条`,
      `覆盖 ${result.stats.overwrittenCommentCount} 条`,
      `跳过 ${result.stats.skippedCommentCount} 条`
    ]
    if (result.stats.ignoredStudentCount) {
      messages.push(`忽略 ${result.stats.ignoredStudentCount} 名未匹配学生`)
    }

    ElMessage.success(`评语导入完成：${messages.join('，')}`)
    resetExcelImport()
    await navigateAfterImport('/comment')
  }

  return {
    excelFileInputRef,
    importingExcel,
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
