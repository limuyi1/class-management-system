import { shallowRef, watch } from 'vue'

import { ElMessage, ElMessageBox } from 'element-plus'

import { storeToRefs } from 'pinia'

import { useDataSourceStore } from '@/stores/data-source'
import { useDutyRosterStore } from '@/stores/duty-roster'
import { DutyRosterModeEnum } from '@/types/DutyRoster'

import type {
  ExcelStudentSourceType,
  StudentSourceStudentType,
  StudentSourceType
} from '@/types/StudentSource'
import type { useDutyRosterInteraction } from '@/views/duty-roster/composables/useDutyRosterInteraction'

/** 管理值日表创建、日周模式和名单切换，替换名单前确认清空已有分配。 */
export function useDutyRosterStudents(
  interaction: Pick<
    ReturnType<typeof useDutyRosterInteraction>,
    'studentMenu' | 'closeContextMenus'
  >
) {
  const dutyStore = useDutyRosterStore()
  const dataSourceStore = useDataSourceStore()
  const { editingRoster, assignedCount } = storeToRefs(dutyStore)
  const { studentMenu, closeContextMenus } = interaction

  const importVisible = shallowRef(false)

  const importTarget = shallowRef<'create' | 'replace'>('create')

  // 新建值日表的默认安排方式与名单来源
  const initialMode = shallowRef(DutyRosterModeEnum.Daily)

  const initialSource = shallowRef<StudentSourceType>(
    dataSourceStore.enabledData.length ? 'system' : 'excel'
  )

  const initialExcelSource = shallowRef<ExcelStudentSourceType | null>(null)

  // 学生数据源变化时重新校准名单，并同步“新建值日表”的默认来源
  watch(
    () => dataSourceStore.enabledData.map((student) => student.studentId).join(','),
    () => {
      dutyStore.reconcileStudents()
      // 已有值日表或已上传 Excel 名单时，不覆盖用户当前选择
      if (!editingRoster.value && !initialExcelSource.value) {
        initialSource.value = dataSourceStore.enabledData.length ? 'system' : 'excel'
      }
    }
  )

  /** 进入新建值日表流程，重置默认模式与名单来源 */
  function startCreatingRoster(): void {
    initialMode.value = DutyRosterModeEnum.Daily
    initialExcelSource.value = null
    initialSource.value = dataSourceStore.enabledData.length ? 'system' : 'excel'
    dutyStore.startCreatingRoster()
  }

  /** 根据所选模式与名单来源创建值日表；Excel 未上传时先打开导入弹窗 */
  function createInitialRoster(): void {
    if (initialSource.value === 'excel' && !initialExcelSource.value) {
      importTarget.value = 'create'
      importVisible.value = true
      return
    }
    dutyStore.createRoster({
      mode: initialMode.value,
      studentSource: initialSource.value,
      excelSource: initialExcelSource.value || undefined
    })
  }

  /** 切换到指定值日表并关闭右键菜单 */
  function selectRoster(rosterId: string): void {
    dutyStore.setEditingRoster(rosterId)
    closeContextMenus()
  }

  /**
   * 弹窗重命名指定值日表。
   * @param rosterId - 值日表 ID
   */
  async function renameRoster(rosterId: string): Promise<void> {
    const roster = dutyStore.rosters.find((item) => item.id === rosterId)
    if (!roster) return
    const { value } = await ElMessageBox.prompt('请输入值日表名称', '重命名', {
      inputValue: roster.name,
      inputPattern: /\S+/,
      inputErrorMessage: '名称不能为空'
    })
    dutyStore.renameRoster(rosterId, value)
  }

  /**
   * 二次确认后删除指定值日表。
   * @param rosterId - 值日表 ID
   */
  async function removeRoster(rosterId: string): Promise<void> {
    await ElMessageBox.confirm('删除后无法恢复该值日表，是否继续？', '删除值日表', {
      type: 'warning'
    })
    dutyStore.deleteRoster(rosterId)
  }

  /**
   * 切换安排方式（每天/每周），已有安排时先二次确认清空。
   * @param mode - 目标安排方式
   */
  async function changeMode(mode: DutyRosterModeEnum): Promise<void> {
    // 未进入编辑或模式未变化时无需处理
    if (!editingRoster.value || editingRoster.value.mode === mode) return
    if (assignedCount.value) {
      try {
        await ElMessageBox.confirm(
          '切换安排方式后，当前学生安排将被清空。是否继续？',
          '切换安排方式',
          {
            type: 'warning'
          }
        )
      } catch {
        return
      }
    }
    dutyStore.setMode(mode)
  }

  /**
   * 已有安排时二次确认是否清空值日安排。
   * @returns 无已安排学生或用户确认时返回 true
   */
  async function confirmClearAssignments(): Promise<boolean> {
    // 没有已安排学生时无需确认
    if (!assignedCount.value) return true
    try {
      await ElMessageBox.confirm(
        '更换学生来源后，当前值日安排将被清空。是否继续？',
        '更换名单来源',
        {
          type: 'warning'
        }
      )
      return true
    } catch {
      return false
    }
  }

  /**
   * 切换当前值日表的学生来源；Excel 来源未上传文件时先打开导入弹窗。
   * @param source - 目标学生来源
   */
  async function changeStudentSource(source: StudentSourceType): Promise<void> {
    // 未进入编辑或来源未变化时无需处理
    if (!editingRoster.value || editingRoster.value.studentSource === source) return
    if (!(await confirmClearAssignments())) return
    if (source === 'excel' && !editingRoster.value.excelSource) {
      importTarget.value = 'replace'
      importVisible.value = true
      return
    }
    dutyStore.setStudentSource(source, editingRoster.value.excelSource)
  }

  /** 打开 Excel 名单导入弹窗，已有值日表时先确认清空影响 */
  async function openStudentImport(): Promise<void> {
    if (editingRoster.value && !(await confirmClearAssignments())) return
    importTarget.value = editingRoster.value ? 'replace' : 'create'
    importVisible.value = true
  }

  /**
   * 处理 Excel 名单导入结果：替换当前来源，或作为新建值日表的初始名单。
   * @param source - 导入得到的 Excel 学生来源
   */
  function handleStudentImport(source: ExcelStudentSourceType): void {
    if (importTarget.value === 'replace' && editingRoster.value) {
      dutyStore.setStudentSource('excel', source)
    } else {
      initialExcelSource.value = source
      initialSource.value = 'excel'
    }
    ElMessage.success(`已导入 ${source.students.length} 名学生`)
  }

  /** 向当前值日表的外部名单追加学生 */
  function addExcelStudent(name: string): void {
    if (!dutyStore.addExcelStudent(name)) return
    ElMessage.success(`已将“${name}”添加到当前值日表`)
  }

  /** 确认后从当前值日表外部名单删除学生及其关联安排 */
  async function removeExcelStudent(student: StudentSourceStudentType): Promise<void> {
    const hasAssignment = dutyStore.assignedStudentIds.includes(student.id)
    const message = hasAssignment
      ? `“${student.name}”已有值日岗位或组长安排，删除后相关安排也会一并移除。是否继续？`
      : `确定从当前值日表名单中删除“${student.name}”吗？`
    try {
      await ElMessageBox.confirm(message, '删除名单学生', { type: 'warning' })
    } catch {
      return
    }
    if (!dutyStore.removeExcelStudent(student.id)) return
    if (studentMenu.value?.studentId === student.id) closeContextMenus()
    ElMessage.success(`已从当前值日表删除“${student.name}”`)
  }
  return {
    importVisible,
    importTarget,
    initialMode,
    initialSource,
    initialExcelSource,
    startCreatingRoster,
    createInitialRoster,
    selectRoster,
    renameRoster,
    removeRoster,
    changeMode,
    confirmClearAssignments,
    changeStudentSource,
    openStudentImport,
    handleStudentImport,
    addExcelStudent,
    removeExcelStudent
  }
}
