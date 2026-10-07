import { computed, nextTick, onBeforeUnmount, onMounted, shallowRef } from 'vue'

import { ElMessageBox } from 'element-plus'

import { storeToRefs } from 'pinia'

import { useDutyRosterStore } from '@/stores/duty-roster'
import {
  findDutySectionByPosition,
  getDutyStudentCardCount
} from '@/utils/duty-roster/dutyRosterUtil'
import DutyScheduleMatrix from '@/views/duty-roster/components/DutyScheduleMatrix.vue'

import type {
  DraggedStudentType,
  PositionMenuType,
  StudentMenuType
} from '@/types/DutyRosterInteraction'
import type { DutyAssignmentTargetType } from '@/types/DutyRoster'

/** 管理学生卡片移动、岗位操作与右键菜单，统一清理全屏和菜单事件监听。 */
export function useDutyRosterInteraction() {
  const dutyStore = useDutyRosterStore()
  const { editingRoster } = storeToRefs(dutyStore)

  // 页面 UI 状态：矩阵引用、全屏、拖拽、弹窗与右键菜单等
  const matrixRef = shallowRef<InstanceType<typeof DutyScheduleMatrix> | null>(null)

  const fullscreen = shallowRef(false)

  const draggedStudent = shallowRef<DraggedStudentType | null>(null)

  const positionMenu = shallowRef<PositionMenuType | null>(null)

  const studentMenu = shallowRef<StudentMenuType | null>(null)

  /** 右键菜单所指向岗位所属的清洁区域 */
  const currentPositionSection = computed(() => {
    if (!editingRoster.value || !positionMenu.value) return null
    return findDutySectionByPosition(editingRoster.value, positionMenu.value.positionId) || null
  })

  /** 仅当区域内有多个岗位时才允许删除当前列 */
  const canRemovePosition = computed(() =>
    Boolean(currentPositionSection.value && currentPositionSection.value.positions.length > 1)
  )

  /** 表格菜单指向的学生是否为当前时段、当前区域的组长 */
  const menuStudentIsLeader = computed(() => {
    const menu = studentMenu.value
    if (!editingRoster.value || menu?.location !== 'assigned' || !menu.target) return false
    const section = findDutySectionByPosition(editingRoster.value, menu.target.positionId)
    return editingRoster.value.leaders.some(
      (leader) =>
        leader.studentId === menu.studentId &&
        leader.period === menu.target?.period &&
        leader.rowId === menu.target?.rowId &&
        leader.sectionId === section?.id
    )
  })

  /** 右侧菜单中的学生是否还允许删除一张卡片 */
  const canDeletePendingCard = computed(() => {
    if (!editingRoster.value || studentMenu.value?.location !== 'pending') return false
    return getDutyStudentCardCount(editingRoster.value, studentMenu.value.studentId) > 1
  })

  onMounted(() => {
    dutyStore.reconcileStudents()
    document.addEventListener('click', closeContextMenus)
    window.addEventListener('keydown', handleKeydown)
  })

  onBeforeUnmount(() => {
    document.removeEventListener('click', closeContextMenus)
    window.removeEventListener('keydown', handleKeydown)
  })

  /** 关闭所有右键菜单 */
  function closeContextMenus(): void {
    positionMenu.value = null
    studentMenu.value = null
  }

  /**
   * 处理键盘快捷键：Esc 退出全屏并关闭右键菜单。
   * @param event - 键盘事件
   */
  function handleKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape' && fullscreen.value) fullscreen.value = false
    if (event.key === 'Escape') closeContextMenus()
  }

  /** 从右侧待选区开始拖拽学生。 */
  function dragPendingStudent(studentId: string): void {
    draggedStudent.value = { studentId }
    closeContextMenus()
  }

  /** 从表格岗位开始拖拽一张学生卡片。 */
  function dragAssignedStudent(studentId: string, source: DutyAssignmentTargetType): void {
    draggedStudent.value = { studentId, source }
    closeContextMenus()
  }

  /** 结束学生拖拽 */
  function endStudentDrag(): void {
    draggedStudent.value = null
  }

  /**
   * 将拖拽中的学生分配到指定岗位。
   * @param target - 值日分配目标
   */
  function dropStudent(target: DutyAssignmentTargetType): void {
    if (!draggedStudent.value) return
    if (draggedStudent.value.source) {
      dutyStore.moveStudent(draggedStudent.value.studentId, draggedStudent.value.source, target)
    } else {
      dutyStore.assignStudent(draggedStudent.value.studentId, target)
    }
    draggedStudent.value = null
  }

  /** 将表格中的当前学生卡片拖回待选区。 */
  function dropToUnassigned(): void {
    if (draggedStudent.value?.source) {
      dutyStore.removeStudentAssignment(draggedStudent.value.studentId, draggedStudent.value.source)
    }
    draggedStudent.value = null
  }

  /**
   * 打开岗位右键菜单。
   * @param positionId - 岗位 ID
   * @param x - 菜单横坐标
   * @param y - 菜单纵坐标
   */
  function openPositionMenu(positionId: string, x: number, y: number): void {
    studentMenu.value = null
    positionMenu.value = { positionId, x, y }
  }

  /**
   * 打开学生右键菜单。
   * @param studentId - 学生 ID
   * @param x - 菜单横坐标
   * @param y - 菜单纵坐标
   */
  function openAssignedStudentMenu(
    studentId: string,
    target: DutyAssignmentTargetType,
    x: number,
    y: number
  ): void {
    positionMenu.value = null
    studentMenu.value = { studentId, location: 'assigned', target, x, y }
  }

  /** 打开右侧待选学生菜单。 */
  function openPendingStudentMenu(studentId: string, x: number, y: number): void {
    positionMenu.value = null
    studentMenu.value = { studentId, location: 'pending', x, y }
  }

  /** 在右键菜单指向的岗位后新增一列，并进入重命名状态 */
  async function addPosition(): Promise<void> {
    const target = positionMenu.value
    const section = currentPositionSection.value
    if (!target || !section) return
    const positionId = dutyStore.addPosition(section.id, target.positionId)
    closeContextMenus()
    if (!positionId) return
    await nextTick()
    await matrixRef.value?.editPosition(positionId)
  }

  /** 删除右键菜单指向的岗位，已有学生时先二次确认 */
  async function removePosition(): Promise<void> {
    const target = positionMenu.value
    if (!target || !canRemovePosition.value) return
    const count = dutyStore.getPositionStudentCount(target.positionId)
    if (count) {
      try {
        await ElMessageBox.confirm(
          `该岗位已有 ${count} 名学生，删除后学生将回到未安排区域。是否继续？`,
          '删除岗位',
          { type: 'warning' }
        )
      } catch {
        return
      }
    }
    dutyStore.removePosition(target.positionId)
    closeContextMenus()
  }

  /** 在周模式下新增一值日行 */
  function addWeeklyRow(): void {
    dutyStore.addWeeklyRow()
  }

  /**
   * 删除指定值日行，已有学生时先二次确认。
   * @param rowId - 值日行 ID
   */
  async function removeWeeklyRow(rowId: string): Promise<void> {
    const count = dutyStore.getWeeklyRowStudentCount(rowId)
    if (count) {
      try {
        await ElMessageBox.confirm(
          `该行已有 ${count} 名学生，删除后学生将回到未安排区域。是否继续？`,
          '删除值日行',
          { type: 'warning' }
        )
      } catch {
        return
      }
    }
    dutyStore.removeWeeklyRow(rowId)
  }

  /** 复制菜单指向的学生卡片，新卡片进入右侧待选区。 */
  function copyMenuStudent(): void {
    if (studentMenu.value) dutyStore.copyStudentCard(studentMenu.value.studentId)
    closeContextMenus()
  }

  /** 删除右侧菜单指向的一张待选卡片。 */
  function deleteMenuStudent(): void {
    if (studentMenu.value?.location === 'pending') {
      dutyStore.deletePendingStudentCard(studentMenu.value.studentId)
    }
    closeContextMenus()
  }

  /** 将表格菜单指向的当前卡片移回右侧待选区。 */
  function removeMenuStudent(): void {
    if (studentMenu.value?.location === 'assigned' && studentMenu.value.target) {
      dutyStore.removeStudentAssignment(studentMenu.value.studentId, studentMenu.value.target)
    }
    closeContextMenus()
  }

  /** 设置或取消表格菜单指向学生的组长身份。 */
  function toggleMenuStudentLeader(): void {
    if (studentMenu.value?.location === 'assigned' && studentMenu.value.target) {
      dutyStore.toggleLeader(studentMenu.value.studentId, studentMenu.value.target)
    }
    closeContextMenus()
  }
  return {
    matrixRef,
    fullscreen,
    draggedStudent,
    positionMenu,
    studentMenu,
    currentPositionSection,
    canRemovePosition,
    menuStudentIsLeader,
    canDeletePendingCard,
    closeContextMenus,
    handleKeydown,
    dragPendingStudent,
    dragAssignedStudent,
    endStudentDrag,
    dropStudent,
    dropToUnassigned,
    openPositionMenu,
    openAssignedStudentMenu,
    openPendingStudentMenu,
    addPosition,
    removePosition,
    addWeeklyRow,
    removeWeeklyRow,
    copyMenuStudent,
    deleteMenuStudent,
    removeMenuStudent,
    toggleMenuStudentLeader
  }
}
