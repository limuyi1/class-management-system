<script setup lang="ts">
import { computed, nextTick, shallowRef } from 'vue'

import DutyAssignmentCell from './DutyAssignmentCell.vue'
import {
  DutyPeriodEnum,
  DutyRosterModeEnum,
  type DutyAssignmentTargetType,
  type DutyPositionType,
  type DutyRosterType,
  type DutySectionType
} from '@/types/DutyRoster'
import {
  DUTY_PERIOD_LABELS,
  getDutyAssignment,
  getDutyPeriods
} from '@/utils/duty-roster/dutyRosterUtil'

/** 矩阵行数据：每日模式按时段生成，周模式按自定义行生成 */
interface DutyMatrixRowType {
  key: string
  period: DutyPeriodEnum
  rowId?: string
}

const props = defineProps<{
  roster: DutyRosterType
  studentNames: Record<string, string>
}>()

const emit = defineEmits<{
  renamePosition: [positionId: string, name: string]
  positionContext: [positionId: string, x: number, y: number]
  studentContext: [studentId: string, target: DutyAssignmentTargetType, x: number, y: number]
  dragStudentStart: [studentId: string, target: DutyAssignmentTargetType]
  dragStudentEnd: []
  dropStudent: [target: DutyAssignmentTargetType]
  reorderPosition: [sectionId: string, sourceId: string, targetId: string]
  addWeeklyRow: []
  removeWeeklyRow: [rowId: string]
  editSectionLeader: [sectionId: string]
}>()

// 矩阵容器引用与岗位重命名状态
const matrixRef = shallowRef<HTMLElement | null>(null)

const editingPositionId = shallowRef<string | null>(null)

const positionDraft = shallowRef('')

const dragOverTargetKey = shallowRef<string | null>(null)

/** 按排序整理后的区域与岗位列表 */
const sections = computed(() =>
  [...props.roster.sections]
    .sort((left, right) => left.sortOrder - right.sortOrder)
    .map((section) => ({
      ...section,
      leaderName: section.leaderStudentId ? props.studentNames[section.leaderStudentId] || '' : '',
      positions: [...section.positions].sort((left, right) => left.sortOrder - right.sortOrder)
    }))
)

/** 是否为“每组一天”模式 */
const isDaily = computed(() => props.roster.mode === DutyRosterModeEnum.Daily)

/** 矩阵数据行：每日模式按时段，周模式按自定义行 */
const rows = computed<DutyMatrixRowType[]>(() => {
  if (isDaily.value) {
    return getDutyPeriods(props.roster.mode).map((period) => ({ key: period, period }))
  }
  return [...(props.roster.weeklyRows || [])]
    .sort((left, right) => left.sortOrder - right.sortOrder)
    .map((row) => ({ key: row.id, period: DutyPeriodEnum.Weekly, rowId: row.id }))
})

/** 表格总列数 = 所有岗位列 + 1（时段/行操作列） */
const columnCount = computed(
  () => sections.value.reduce((count, section) => count + section.positions.length, 0) + 1
)

/** 根据岗位数量和类型计算矩阵最小宽度，给多人岗位留出双列排列空间 */
const matrixMinWidth = computed(() => {
  const positionWidth = sections.value.reduce(
    (width, section) =>
      width + section.positions.length * (section.kind === 'cleaning' ? 188 : 140),
    0
  )
  const utilityWidth = isDaily.value ? 82 : 34
  return Math.max(positionWidth + utilityWidth, isDaily.value ? 980 : 860)
})

/**
 * 获取指定分配目标下的学生 ID 列表。
 * @param target - 值日分配目标
 */
function getStudentIds(target: DutyAssignmentTargetType): string[] {
  return (
    getDutyAssignment(props.roster.assignments, target.period, target.positionId, target.rowId)
      ?.studentIds || []
  )
}

/**
 * 按 ID 查找岗位。
 * @param positionId - 岗位 ID
 */
function findPosition(positionId: string): DutyPositionType | undefined {
  return sections.value
    .flatMap((section) => section.positions)
    .find((position) => position.id === positionId)
}

/**
 * 进入岗位重命名状态，并自动选中输入框内容。
 * @param positionId - 岗位 ID
 */
async function editPosition(positionId: string): Promise<void> {
  const position = findPosition(positionId)
  if (!position) return
  editingPositionId.value = positionId
  positionDraft.value = position.name
  await nextTick()
  const input = matrixRef.value?.querySelector<HTMLInputElement>(
    `[data-position-input="${positionId}"]`
  )
  input?.select()
}

/**
 * 提交岗位重命名。
 * @param positionId - 岗位 ID
 */
function commitPosition(positionId: string): void {
  const name = positionDraft.value.trim()
  if (name) emit('renamePosition', positionId, name)
  editingPositionId.value = null
}

/** 取消岗位重命名 */
function cancelPositionEdit(): void {
  editingPositionId.value = null
}

/**
 * 处理岗位表头右键，触发岗位菜单。
 * @param event - 鼠标事件
 * @param positionId - 岗位 ID
 */
function handlePositionContext(event: MouseEvent, positionId: string): void {
  event.preventDefault()
  emit('positionContext', positionId, event.clientX, event.clientY)
}

/** 通过可见按钮打开岗位操作菜单，补充右键操作入口 */
function handlePositionAction(event: MouseEvent, positionId: string): void {
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
  emit('positionContext', positionId, rect.right, rect.bottom + 4)
}

/**
 * 处理学生右键，触发学生菜单并阻止冒泡。
 * @param event - 鼠标事件
 * @param studentId - 学生 ID
 */
function handleStudentContext(
  event: MouseEvent,
  studentId: string,
  target: DutyAssignmentTargetType
): void {
  event.preventDefault()
  event.stopPropagation()
  emit('studentContext', studentId, target, event.clientX, event.clientY)
}

/** 生成分配单元格的稳定标识，用于拖拽反馈 */
function getTargetKey(rowKey: string, positionId: string): string {
  return `${rowKey}-${positionId}`
}

/** 学生拖入岗位时高亮当前目标；岗位表头拖拽不触发该反馈 */
function handleCellDragEnter(event: DragEvent, targetKey: string): void {
  if (event.dataTransfer?.types.includes('application/x-duty-position')) return
  dragOverTargetKey.value = targetKey
}

/** 离开整个单元格后清除拖拽反馈 */
function handleCellDragLeave(event: DragEvent, targetKey: string): void {
  const cell = event.currentTarget as HTMLElement
  const relatedTarget = event.relatedTarget
  if (relatedTarget instanceof Node && cell.contains(relatedTarget)) return
  if (dragOverTargetKey.value === targetKey) dragOverTargetKey.value = null
}

/** 完成学生投放并复位拖拽反馈 */
function handleStudentDrop(target: DutyAssignmentTargetType): void {
  dragOverTargetKey.value = null
  emit('dropStudent', target)
}

/** 学生拖拽结束时复位组件内反馈状态 */
function handleStudentDragEnd(): void {
  dragOverTargetKey.value = null
  emit('dragStudentEnd')
}

/**
 * 记录拖拽中的岗位 ID，用于岗位排序。
 * @param event - 拖拽事件
 * @param positionId - 岗位 ID
 */
function handlePositionDragStart(event: DragEvent, positionId: string): void {
  event.dataTransfer?.setData('application/x-duty-position', positionId)
  if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move'
}

/**
 * 处理岗位拖放，完成区域内岗位重排。
 * @param event - 拖放事件
 * @param section - 目标区域
 * @param targetId - 目标岗位 ID
 */
function handlePositionDrop(event: DragEvent, section: DutySectionType, targetId: string): void {
  const sourceId = event.dataTransfer?.getData('application/x-duty-position') || ''
  // 仅在源岗位属于当前区域时触发重排
  if (sourceId && section.positions.some((position) => position.id === sourceId)) {
    emit('reorderPosition', section.id, sourceId, targetId)
  }
}

defineExpose({ editPosition })
</script>

<template>
  <el-scrollbar class="app-scroll-region"
    ><div ref="matrixRef" class="duty-matrix-scroll">
      <table
        class="duty-matrix"
        :class="{ 'is-weekly': !isDaily }"
        :style="{ minWidth: `${matrixMinWidth}px` }"
      >
        <colgroup>
          <col v-if="isDaily" class="duty-matrix__period-column" />
          <template v-for="section in sections" :key="`columns-${section.id}`">
            <col
              v-for="position in section.positions"
              :key="position.id"
              class="duty-matrix__position-column"
              :class="{ 'is-cleaning': section.kind === 'cleaning' }"
            />
          </template>
          <col v-if="!isDaily" class="duty-matrix__action-column" />
        </colgroup>
        <thead>
          <tr class="duty-matrix__section-row">
            <th v-if="isDaily" class="duty-matrix__period-head" rowspan="2" scope="col">星期</th>
            <th
              v-for="section in sections"
              :key="section.id"
              class="duty-matrix__section-head"
              :class="`is-${section.kind}`"
              :colspan="section.positions.length"
              scope="colgroup"
            >
              <span>{{ section.name }}</span>
              <template v-if="section.leaderName">
                <span>（</span>
                <span class="duty-matrix__section-leader-name">{{ section.leaderName }}</span>
                <span>）</span>
              </template>
              <button
                class="duty-matrix__section-action"
                type="button"
                :aria-label="`设置${section.name}大组长`"
                title="设置大组长"
                @click.stop="emit('editSectionLeader', section.id)"
              >
                <font-awesome-icon :icon="['solid', 'user-pen']" />
              </button>
            </th>
            <th v-if="!isDaily" class="duty-matrix__row-action-head" rowspan="2">
              <span class="sr-only">行操作</span>
            </th>
          </tr>
          <tr class="duty-matrix__position-row">
            <template v-for="section in sections" :key="section.id">
              <th
                v-for="position in section.positions"
                :key="position.id"
                class="duty-matrix__position-head"
                :class="{ 'is-cleaning': section.kind === 'cleaning' }"
                :draggable="editingPositionId !== position.id"
                scope="col"
                @dblclick="editPosition(position.id)"
                @contextmenu="handlePositionContext($event, position.id)"
                @dragstart="handlePositionDragStart($event, position.id)"
                @dragover.prevent
                @drop.prevent="handlePositionDrop($event, section, position.id)"
              >
                <input
                  v-if="editingPositionId === position.id"
                  v-model="positionDraft"
                  class="duty-matrix__position-input"
                  :data-position-input="position.id"
                  maxlength="18"
                  @click.stop
                  @dblclick.stop
                  @blur="commitPosition(position.id)"
                  @keydown.enter.prevent="commitPosition(position.id)"
                  @keydown.esc.prevent="cancelPositionEdit"
                />
                <div v-else class="duty-matrix__position-content">
                  <span class="duty-matrix__position-label">
                    <font-awesome-icon :icon="['solid', 'grip-vertical']" />
                    <span>{{ position.name }}</span>
                  </span>
                  <button
                    class="duty-matrix__position-action"
                    type="button"
                    draggable="false"
                    :aria-label="`打开${position.name}岗位菜单`"
                    title="岗位操作"
                    @click.stop="handlePositionAction($event, position.id)"
                    @dblclick.stop
                    @mousedown.stop
                    @dragstart.stop.prevent
                  >
                    <font-awesome-icon :icon="['solid', 'ellipsis']" />
                  </button>
                </div>
              </th>
            </template>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in rows" :key="row.key" class="duty-matrix__data-row">
            <th v-if="isDaily" class="duty-matrix__period-cell" scope="row">
              {{ DUTY_PERIOD_LABELS[row.period] }}
            </th>
            <template v-for="section in sections" :key="`${row.key}-${section.id}`">
              <DutyAssignmentCell
                v-for="position in section.positions"
                :key="`${row.key}-${position.id}`"
                :target="{ period: row.period, rowId: row.rowId, positionId: position.id }"
                :student-ids="
                  getStudentIds({ period: row.period, rowId: row.rowId, positionId: position.id })
                "
                :student-names="studentNames"
                :leader-ids="roster.leaders.map((leader) => leader.studentId)"
                :cleaning="section.kind === 'cleaning'"
                :drop-target="dragOverTargetKey === getTargetKey(row.key, position.id)"
                @drag-enter="handleCellDragEnter($event, getTargetKey(row.key, position.id))"
                @drag-leave="handleCellDragLeave($event, getTargetKey(row.key, position.id))"
                @drop-student="handleStudentDrop"
                @drag-student-start="
                  (studentId: string, target: DutyAssignmentTargetType) =>
                    emit('dragStudentStart', studentId, target)
                "
                @drag-student-end="handleStudentDragEnd"
                @student-context="handleStudentContext"
              />
            </template>
            <th v-if="!isDaily" class="duty-matrix__row-action-cell">
              <button
                v-if="rows.length > 1"
                class="duty-matrix__remove-row"
                type="button"
                aria-label="删除当前行"
                title="删除当前行"
                @click="emit('removeWeeklyRow', row.rowId!)"
              >
                <font-awesome-icon :icon="['regular', 'trash-can']" />
              </button>
            </th>
          </tr>
          <tr v-if="!isDaily" class="duty-matrix__add-row">
            <td :colspan="columnCount">
              <button type="button" @click="emit('addWeeklyRow')">
                <font-awesome-icon :icon="['solid', 'plus']" />
                新增一行
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div></el-scrollbar
  >
</template>

<style scoped lang="scss" src="./styles/duty-schedule-matrix.scss"></style>
