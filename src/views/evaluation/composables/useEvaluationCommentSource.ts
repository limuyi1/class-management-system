import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { onBeforeRouteLeave } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'

import {
  EXCEL_COMMENT_TAG_PROP,
  exportExcelCommentWorkspace
} from '@/utils/commentWorkspaceExcelUtil'

import type {
  CommentWorkspaceSourceType,
  ExcelCommentImportSelectionType,
  ExcelCommentWorkspaceType
} from '@/types/CommentWorkspace'
import type { StudentDataType } from '@/types/StudentData'
import type { TagCategoryType } from '@/types/Setting'
import type { Ref } from 'vue'

/** 评语数据源组合式函数的入参 */
interface UseEvaluationCommentSourceOptionsType {
  systemStudents: Ref<StudentDataType[]>
  systemTagCategories: Ref<TagCategoryType[]>
}

/** Excel 导入完成后返回的工作区数据 */
type ExcelImportResultType = ExcelCommentImportSelectionType &
  Pick<ExcelCommentWorkspaceType, 'students' | 'skippedEmptyNameCount'>

/**
 * 管理期末评语的数据来源（系统学生 / Excel 临时数据）。
 *
 * Excel 数据只保存在内存中，切换来源或离开页面时会校验未导出的修改，
 * 并拦截浏览器刷新/路由离开以提示用户。
 *
 * @param options 系统学生与标签分类的响应式引用
 * @returns 数据源状态、学生列表及各类操作
 */
export function useEvaluationCommentSource(options: UseEvaluationCommentSourceOptionsType) {
  const source = ref<CommentWorkspaceSourceType>('system')
  const importDialogVisible = ref(false)
  const excelWorkspace = ref<ExcelCommentWorkspaceType | null>(null)
  const excelExporting = ref(false)
  const exportedComments = ref<Record<string, string>>({})

  const students = computed(() =>
    source.value === 'excel' ? (excelWorkspace.value?.students ?? []) : options.systemStudents.value
  )
  const tagCategories = computed(() =>
    source.value === 'excel'
      ? [{ prop: EXCEL_COMMENT_TAG_PROP, label: '临时标签' }]
      : options.systemTagCategories.value
  )
  const allowTagEditing = computed(() => source.value === 'system')
  const excelFileName = computed(() => excelWorkspace.value?.fileName || '')
  const excelStudentCount = computed(() => excelWorkspace.value?.students.length || 0)
  const hasUnexportedExcelChanges = computed(() => {
    if (!excelWorkspace.value) return false
    return excelWorkspace.value.students.some(
      (student) =>
        (student.comment?.trim() || '') !== (exportedComments.value[student.studentId] || '')
    )
  })

  const captureExportedComments = (): void => {
    exportedComments.value = Object.fromEntries(
      (excelWorkspace.value?.students ?? []).map((student) => [
        student.studentId,
        student.comment?.trim() || ''
      ])
    )
  }

  const confirmDiscardExcelChanges = async (): Promise<boolean> => {
    if (!hasUnexportedExcelChanges.value) return true
    try {
      await ElMessageBox.confirm(
        '当前 Excel 临时数据有尚未导出的评语修改，离开后这些修改会丢失。是否继续？',
        '未导出提示',
        {
          confirmButtonText: '继续离开',
          cancelButtonText: '留在当前页面',
          type: 'warning'
        }
      )
      return true
    } catch {
      return false
    }
  }

  const handleSourceChange = async (nextSource: CommentWorkspaceSourceType): Promise<void> => {
    if (nextSource === source.value) return
    if (source.value === 'excel' && !(await confirmDiscardExcelChanges())) return

    if (source.value === 'excel') {
      excelWorkspace.value = null
      exportedComments.value = {}
    }

    if (nextSource === 'excel' && !excelWorkspace.value) {
      // 首次切换到 Excel 数据源时先打开导入弹窗，导入成功后再真正切换
      importDialogVisible.value = true
      return
    }
    source.value = nextSource
  }

  const handleUploadRequest = async (): Promise<void> => {
    if (source.value === 'excel' && !(await confirmDiscardExcelChanges())) return
    importDialogVisible.value = true
  }

  /**
   * Excel 工作区只保存在当前组合式函数的内存 Ref 中，不进入 Pinia/Dexie。
   * 即使姓名与本班学生相同，也不会执行匹配或回写，保证代处理外班数据时完全隔离。
   */
  const handleExcelImport = (value: ExcelImportResultType): void => {
    excelWorkspace.value = value
    source.value = 'excel'
    captureExportedComments()
    if (value.skippedEmptyNameCount) {
      ElMessage.warning(`已跳过 ${value.skippedEmptyNameCount} 行空姓名数据`)
    }
    ElMessage.success(`已载入 ${value.students.length} 条临时学生数据`)
  }

  const handleExcelExport = async (): Promise<void> => {
    if (!excelWorkspace.value) {
      ElMessage.warning('请先上传 Excel 文件')
      return
    }

    excelExporting.value = true
    try {
      await exportExcelCommentWorkspace(excelWorkspace.value)
      captureExportedComments()
      ElMessage.success('评语 Excel 导出成功')
    } catch (error) {
      console.error('导出临时评语 Excel 失败:', error)
      ElMessage.error(error instanceof Error ? error.message : '评语 Excel 导出失败')
    } finally {
      excelExporting.value = false
    }
  }

  const handleBeforeUnload = (event: BeforeUnloadEvent): void => {
    if (!hasUnexportedExcelChanges.value) return
    event.preventDefault()
    event.returnValue = ''
  }

  onMounted(() => window.addEventListener('beforeunload', handleBeforeUnload))
  onBeforeUnmount(() => window.removeEventListener('beforeunload', handleBeforeUnload))
  onBeforeRouteLeave(() => confirmDiscardExcelChanges())

  return {
    allowTagEditing,
    excelExporting,
    excelFileName,
    excelStudentCount,
    handleExcelExport,
    handleExcelImport,
    handleSourceChange,
    handleUploadRequest,
    importDialogVisible,
    source,
    students,
    tagCategories
  }
}
