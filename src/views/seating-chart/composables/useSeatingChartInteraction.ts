import { computed, onBeforeUnmount, onMounted, ref, shallowRef } from 'vue'

import { ElMessage, ElMessageBox } from 'element-plus'

import { storeToRefs } from 'pinia'

import { useSeatingChartStore } from '@/stores/seating-chart'
import {
  SeatingSpecialSeatPositionEnum,
  type SeatingRoleAssignmentType,
  type SeatingRoleDefinitionType,
  type SeatingSpecialSeatType,
  type SeatPositionType
} from '@/types/SeatingChart'

/** 管理座位选择、拖拽、职务菜单与全屏快捷键，并在卸载时清理事件监听。 */
export function useSeatingChartInteraction() {
  const seatingStore = useSeatingChartStore()
  const { activeStudents, editingChart } = storeToRefs(seatingStore)

  // 页面是否全屏显示
  const fullscreen = shallowRef(false)

  // 正在拖拽的学生 ID，跨组件传递拖拽目标
  const draggedStudentId = ref<string | null>(null)

  // 点击选中的学生 ID，用于拖拽或点击落座
  const selectedStudentId = ref<string | null>(null)

  const roleManagementVisible = shallowRef(false)

  const studentMenu = shallowRef<{ studentId: string; x: number; y: number } | null>(null)

  /** 学生 ID 到姓名的映射，供画布与提示文案使用 */
  const studentNames = computed(
    () => new Map(activeStudents.value.map((student) => [student.id, student.name]))
  )

  /** 学生姓名字典，供需要普通对象格式的子组件使用 */
  const studentNameRecord = computed<Record<string, string>>(() =>
    Object.fromEntries(studentNames.value)
  )

  /** 右键菜单当前学生的姓名 */
  const menuStudentName = computed(() =>
    studentMenu.value ? studentNames.value.get(studentMenu.value.studentId) || '未命名学生' : ''
  )

  /** 右键菜单当前学生已有的职务 */
  const menuAssignedRoleIds = computed(
    () =>
      editingChart.value?.roleAssignments.find(
        (assignment) => assignment.studentId === studentMenu.value?.studentId
      )?.roleIds || []
  )

  // 挂载时校对名单数据，并注册键盘快捷键监听
  onMounted(() => {
    seatingStore.reconcileStudents()
    document.addEventListener('click', closeStudentMenu)
    window.addEventListener('keydown', handleKeydown)
  })

  // 卸载时移除键盘监听
  onBeforeUnmount(() => {
    document.removeEventListener('click', closeStudentMenu)
    window.removeEventListener('keydown', handleKeydown)
  })

  /** 关闭学生职务右键菜单 */
  function closeStudentMenu(): void {
    studentMenu.value = null
  }

  /** 将拖拽或选中的学生放入指定座位 */
  function dropOnSeat(seat: SeatPositionType): void {
    const studentId = draggedStudentId.value || selectedStudentId.value
    if (!studentId) return
    seatingStore.assignStudent(studentId, seat.row, seat.column)
    selectedStudentId.value = null
    draggedStudentId.value = null
  }

  /**
   * 点击座位：已有选中学生时执行落座，否则选中该座位上的学生。
   * @param seat - 被点击的座位
   */
  function selectSeat(seat: SeatPositionType): void {
    if (selectedStudentId.value) {
      dropOnSeat(seat)
      return
    }
    if (seat.studentId) selectedStudentId.value = seat.studentId
  }

  /** 将拖拽中的学生移回未安排列表 */
  function dropToUnassigned(): void {
    if (draggedStudentId.value) seatingStore.unassignStudent(draggedStudentId.value)
    draggedStudentId.value = null
  }

  /**
   * 开关雅座；关闭已占用雅座前需二次确认，避免学生意外回到未安排。
   * @param position - 雅座位置
   * @param enabled - 是否启用
   */
  async function toggleSpecialSeat(
    position: SeatingSpecialSeatPositionEnum,
    enabled: boolean
  ): Promise<void> {
    const seat = editingChart.value?.specialSeats.find((item) => item.position === position)
    if (!seat) return
    if (!enabled && seat.studentId) {
      try {
        await ElMessageBox.confirm(
          `${studentNames.value.get(seat.studentId)} 将回到未安排学生，是否关闭该雅座？`,
          '关闭雅座',
          { type: 'warning' }
        )
      } catch {
        return
      }
    }
    seatingStore.setSpecialSeatEnabled(position, enabled)
  }

  /**
   * 将拖拽或选中的学生放入指定雅座。
   * @param position - 雅座位置
   */
  function dropOnSpecialSeat(position: SeatingSpecialSeatPositionEnum): void {
    // 优先使用拖拽中的学生，其次使用点击选中的学生
    const studentId = draggedStudentId.value || selectedStudentId.value
    if (!studentId) return
    seatingStore.assignStudentToSpecial(studentId, position)
    selectedStudentId.value = null
    draggedStudentId.value = null
  }

  /**
   * 点击雅座：已有选中学生时执行落座，否则选中该雅座上的学生。
   * @param seat - 被点击的雅座
   */
  function selectSpecialSeat(seat: SeatingSpecialSeatType): void {
    if (selectedStudentId.value) {
      dropOnSpecialSeat(seat.position)
      return
    }
    if (seat.studentId) selectedStudentId.value = seat.studentId
  }

  /** 打开学生职务右键菜单 */
  function openStudentMenu(studentId: string, x: number, y: number): void {
    studentMenu.value = { studentId, x, y }
  }

  /** 从右键菜单切换当前学生的职务 */
  function toggleMenuStudentRole(roleId: string): void {
    if (!studentMenu.value) return
    seatingStore.toggleStudentRole(studentMenu.value.studentId, roleId)
  }

  /** 从右键菜单进入完整职务管理 */
  function manageRolesFromMenu(): void {
    closeStudentMenu()
    roleManagementVisible.value = true
  }

  /** 保存职务定义和学生分配 */
  function saveRoleSettings(
    definitions: SeatingRoleDefinitionType[],
    assignments: SeatingRoleAssignmentType[]
  ): void {
    seatingStore.setRoleSettings(definitions, assignments)
    ElMessage.success('职务设置已保存')
  }

  /** 切换页面全屏显示 */
  function toggleFullscreen(): void {
    fullscreen.value = !fullscreen.value
  }

  /**
   * 处理键盘快捷键，全屏时按 Esc 退出。
   * @param event - 键盘事件
   */
  function handleKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape' && fullscreen.value) {
      fullscreen.value = false
    }
    if (event.key === 'Escape') closeStudentMenu()
  }
  return {
    fullscreen,
    draggedStudentId,
    selectedStudentId,
    studentMenu,
    studentNames,
    studentNameRecord,
    menuStudentName,
    menuAssignedRoleIds,
    roleManagementVisible,
    closeStudentMenu,
    dropOnSeat,
    selectSeat,
    dropToUnassigned,
    toggleSpecialSeat,
    dropOnSpecialSeat,
    selectSpecialSeat,
    openStudentMenu,
    toggleMenuStudentRole,
    manageRolesFromMenu,
    saveRoleSettings,
    toggleFullscreen,
    handleKeydown
  }
}
