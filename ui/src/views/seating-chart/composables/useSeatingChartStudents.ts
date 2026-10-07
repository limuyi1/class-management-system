import { computed, ref, shallowRef, watch } from 'vue'

import { ElMessage, ElMessageBox } from 'element-plus'

import { storeToRefs } from 'pinia'

import { useDataSourceStore } from '@/stores/data-source'
import { useSeatingChartStore } from '@/stores/seating-chart'
import { SeatingFirstColumnSideEnum } from '@/types/SeatingChart'

import type {
  ExcelStudentSourceType,
  StudentSourceStudentType,
  StudentSourceType
} from '@/types/StudentSource'
import type { Ref } from 'vue'

/** 管理座位表创建、名单来源与外部学生维护；替换来源前确认已有分配的影响。 */
export function useSeatingChartStudents(interaction: {
  selectedStudentId: Ref<string | null>
  studentMenu: Ref<{ studentId: string; x: number; y: number } | null>
  closeStudentMenu: () => void
}) {
  const seatingStore = useSeatingChartStore()
  const dataSourceStore = useDataSourceStore()
  const { editingChart, assignedCount } = storeToRefs(seatingStore)
  const { selectedStudentId, studentMenu, closeStudentMenu } = interaction

  const studentImportVisible = shallowRef(false)

  // Excel 导入的目标：创建新座位表或替换当前名单
  const studentImportTarget = shallowRef<'create' | 'replace'>('create')

  // 新建流程中暂存的学生来源与 Excel 名单，创建时写入 store
  const initialStudentSource = ref<StudentSourceType>(
    dataSourceStore.enabledData.length ? 'system' : 'excel'
  )

  const initialExcelSource = shallowRef<ExcelStudentSourceType | null>(null)

  // 新建座位表时的初始布局设置
  const initialLayout = ref({
    rows: 6,
    columns: 6,
    firstColumnSide: SeatingFirstColumnSideEnum.Left
  })

  /** 当前名单中已有座位或职务的学生 ID，供删除影响提示使用 */
  const managedAssignedStudentIds = computed(() => {
    const studentIds = new Set(seatingStore.assignedStudentIds)
    editingChart.value?.roleAssignments.forEach((assignment) =>
      studentIds.add(assignment.studentId)
    )
    return [...studentIds]
  })

  // 系统学生名单变化时重新校对座位表数据，并同步新建流程的默认来源
  watch(
    () => dataSourceStore.enabledData.map((student) => student.studentId).join(','),
    () => {
      seatingStore.reconcileStudents()
      if (editingChart.value || initialExcelSource.value) return
      initialStudentSource.value = dataSourceStore.enabledData.length ? 'system' : 'excel'
    }
  )

  /** 进入新建座位表流程，重置默认布局与名单来源 */
  function createChart(): void {
    initialLayout.value = {
      rows: 6,
      columns: 6,
      firstColumnSide: SeatingFirstColumnSideEnum.Left
    }
    initialExcelSource.value = null
    initialStudentSource.value = dataSourceStore.enabledData.length ? 'system' : 'excel'
    seatingStore.startCreatingChart()
  }

  /** 依据新建流程中暂存的来源与布局创建座位表；Excel 名单缺失时先打开导入弹窗 */
  function createInitialChart(): void {
    if (initialStudentSource.value === 'system' && dataSourceStore.enabledData.length) {
      seatingStore.createChart({
        studentSource: 'system',
        rows: initialLayout.value.rows,
        columns: initialLayout.value.columns,
        firstColumnSide: initialLayout.value.firstColumnSide
      })
      return
    }
    if (!initialExcelSource.value) {
      openInitialStudentImport()
      return
    }
    seatingStore.createChart({
      studentSource: 'excel',
      excelSource: initialExcelSource.value,
      rows: initialLayout.value.rows,
      columns: initialLayout.value.columns,
      firstColumnSide: initialLayout.value.firstColumnSide
    })
  }

  /** 更换学生来源前确认清空已有安排，返回是否继续 */
  async function confirmClearAssignments(): Promise<boolean> {
    if (!assignedCount.value) return true
    try {
      await ElMessageBox.confirm(
        '更换学生来源后，当前座位安排将被清空。是否继续？',
        '更换数据来源',
        {
          type: 'warning'
        }
      )
      return true
    } catch {
      return false
    }
  }

  /** 处理学生来源切换；Excel 来源缺失名单时先打开导入弹窗 */
  async function handleStudentSourceChange(source: StudentSourceType): Promise<void> {
    if (!editingChart.value || source === editingChart.value.studentSource) return
    if (!(await confirmClearAssignments())) return

    if (source === 'excel') {
      if (!editingChart.value.excelSource) {
        studentImportTarget.value = 'replace'
        studentImportVisible.value = true
        return
      }
      seatingStore.setStudentSource('excel', editingChart.value.excelSource)
      return
    }
    seatingStore.setStudentSource('system')
  }

  /** 打开 Excel 名单导入弹窗；已有座位表时先确认清空安排 */
  async function openStudentImport(): Promise<void> {
    if (editingChart.value && !(await confirmClearAssignments())) return
    studentImportTarget.value = editingChart.value ? 'replace' : 'create'
    studentImportVisible.value = true
  }

  /** 新建流程中打开 Excel 名单导入弹窗 */
  function openInitialStudentImport(): void {
    studentImportTarget.value = 'create'
    studentImportVisible.value = true
  }

  /** 记录新建流程中选择的学生来源 */
  function handleInitialStudentSourceChange(source: StudentSourceType): void {
    initialStudentSource.value = source
  }

  /** 处理 Excel 导入结果：替换当前来源或暂存到新建流程，并提示导入人数 */
  function handleExcelStudentImport(source: ExcelStudentSourceType): void {
    if (studentImportTarget.value === 'replace' && editingChart.value) {
      seatingStore.setStudentSource('excel', source)
    } else {
      initialExcelSource.value = source
      initialStudentSource.value = 'excel'
    }
    ElMessage.success(`已导入 ${source.students.length} 名学生`)
  }

  /** 向当前座位表的外部名单追加学生 */
  function addExcelStudent(name: string): void {
    if (!seatingStore.addExcelStudent(name)) return
    ElMessage.success(`已将“${name}”添加到当前座位表`)
  }

  /** 确认后从当前座位表外部名单删除学生及其关联安排 */
  async function removeExcelStudent(student: StudentSourceStudentType): Promise<void> {
    const hasAssignment = managedAssignedStudentIds.value.includes(student.id)
    const message = hasAssignment
      ? `“${student.name}”已有座位或职务安排，删除后相关安排也会一并移除。是否继续？`
      : `确定从当前座位表名单中删除“${student.name}”吗？`
    try {
      await ElMessageBox.confirm(message, '删除名单学生', { type: 'warning' })
    } catch {
      return
    }
    if (!seatingStore.removeExcelStudent(student.id)) return
    if (selectedStudentId.value === student.id) selectedStudentId.value = null
    if (studentMenu.value?.studentId === student.id) closeStudentMenu()
    ElMessage.success(`已从当前座位表删除“${student.name}”`)
  }

  /** 切换当前编辑的座位表，并清除选中学生 */
  function selectChart(chartId: string): void {
    seatingStore.setEditingChart(chartId)
    selectedStudentId.value = null
    closeStudentMenu()
  }

  /** 弹出输入框重命名座位表 */
  async function renameChart(chartId: string): Promise<void> {
    const chart = seatingStore.charts.find((item) => item.id === chartId)
    if (!chart) return
    const { value } = await ElMessageBox.prompt('请输入座位表名称', '重命名', {
      inputValue: chart.name,
      inputPattern: /\S+/,
      inputErrorMessage: '名称不能为空'
    })
    seatingStore.renameChart(chartId, value)
  }

  /**
   * 二次确认后删除指定座位表。
   * @param chartId - 座位表 ID
   */
  async function deleteChart(chartId: string): Promise<void> {
    await ElMessageBox.confirm('删除后无法恢复该座位表，是否继续？', '删除座位表', {
      type: 'warning'
    })
    seatingStore.deleteChart(chartId)
  }
  return {
    studentImportVisible,
    studentImportTarget,
    initialStudentSource,
    initialExcelSource,
    initialLayout,
    managedAssignedStudentIds,
    createChart,
    createInitialChart,
    confirmClearAssignments,
    handleStudentSourceChange,
    openStudentImport,
    openInitialStudentImport,
    handleInitialStudentSourceChange,
    handleExcelStudentImport,
    addExcelStudent,
    removeExcelStudent,
    selectChart,
    renameChart,
    deleteChart
  }
}
