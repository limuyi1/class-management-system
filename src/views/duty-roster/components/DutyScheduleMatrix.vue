<script setup lang="ts">
import { computed, nextTick, shallowRef } from 'vue'

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
  studentContext: [studentId: string, x: number, y: number]
  dragStudentStart: [studentId: string]
  dragStudentEnd: []
  dropStudent: [target: DutyAssignmentTargetType]
  reorderPosition: [sectionId: string, sourceId: string, targetId: string]
  addWeeklyRow: []
  removeWeeklyRow: [rowId: string]
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
 * 判断学生是否为组长。
 * @param studentId - 学生 ID
 */
function isLeader(studentId: string): boolean {
  return props.roster.leaders.some((leader) => leader.studentId === studentId)
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
function handleStudentContext(event: MouseEvent, studentId: string): void {
  event.preventDefault()
  event.stopPropagation()
  emit('studentContext', studentId, event.clientX, event.clientY)
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
  <div ref="matrixRef" class="duty-matrix-scroll">
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
            {{ section.name }}
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
            <td
              v-for="position in section.positions"
              :key="`${row.key}-${position.id}`"
              class="duty-matrix__cell"
              :class="{
                'is-cleaning': section.kind === 'cleaning',
                'is-drop-target': dragOverTargetKey === getTargetKey(row.key, position.id)
              }"
              @dragover.prevent
              @dragenter.prevent="handleCellDragEnter($event, getTargetKey(row.key, position.id))"
              @dragleave="handleCellDragLeave($event, getTargetKey(row.key, position.id))"
              @drop.prevent="
                handleStudentDrop({
                  period: row.period,
                  rowId: row.rowId,
                  positionId: position.id
                })
              "
            >
              <div class="duty-matrix__students">
                <button
                  v-for="studentId in getStudentIds({
                    period: row.period,
                    rowId: row.rowId,
                    positionId: position.id
                  })"
                  :key="studentId"
                  class="duty-matrix__student"
                  :class="{ 'is-leader': isLeader(studentId) }"
                  type="button"
                  draggable="true"
                  :aria-label="`${studentNames[studentId] || '未知学生'}${
                    isLeader(studentId) ? '，组长' : ''
                  }`"
                  :title="`${studentNames[studentId] || '未知学生'}${
                    isLeader(studentId) ? '（组长）' : ''
                  }｜拖动调整岗位，右键查看更多操作`"
                  @dragstart.stop="emit('dragStudentStart', studentId)"
                  @dragend="handleStudentDragEnd"
                  @contextmenu="handleStudentContext($event, studentId)"
                >
                  <span
                    v-if="isLeader(studentId)"
                    class="duty-matrix__leader-dot"
                    aria-hidden="true"
                  >
                    组
                  </span>
                  <font-awesome-icon
                    v-else
                    class="duty-matrix__student-grip"
                    :icon="['solid', 'grip-vertical']"
                  />
                  <span class="duty-matrix__student-name">
                    {{ studentNames[studentId] || '未知学生' }}
                  </span>
                </button>
                <span
                  v-if="
                    !getStudentIds({
                      period: row.period,
                      rowId: row.rowId,
                      positionId: position.id
                    }).length
                  "
                  class="duty-matrix__empty"
                >
                  拖入学生
                </span>
              </div>
            </td>
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
  </div>
</template>

<style scoped lang="scss">
.duty-matrix-scroll {
  width: 100%;
  overflow: auto;
  border: 1px solid #e4dfeb;
  border-radius: 8px;
  scrollbar-width: thin;
  scrollbar-color: #d8cfdf transparent;
}

.duty-matrix {
  --duty-line: #e7e3eb;
  --duty-text: #303a4f;
  --duty-muted: #756f7e;
  --duty-indoor-tint: #f6f5fa;
  --duty-cleaning-tint: #f1f8f5;
  --duty-cleaning-accent: #65a88e;
  width: 100%;
  border-spacing: 0;
  border-collapse: separate;
  table-layout: fixed;
  color: var(--duty-text);
  background: #fff;
  font-size: 13px;
}

.duty-matrix.is-weekly {
  min-width: 860px;
}

.duty-matrix th,
.duty-matrix td {
  border-right: 1px solid var(--duty-line);
  border-bottom: 1px solid var(--duty-line);
}

.duty-matrix tr > :last-child {
  border-right: 0;
}

.duty-matrix.is-weekly .duty-matrix__position-row > :last-child {
  border-right: 1px solid var(--duty-line);
}

.duty-matrix tbody tr:last-child > * {
  border-bottom: 0;
}

.duty-matrix__period-column {
  width: 82px;
}

.duty-matrix__position-column {
  width: 140px;
}

.duty-matrix__position-column.is-cleaning {
  width: 188px;
}

.duty-matrix__action-column {
  width: 34px;
}

.duty-matrix__period-head {
  position: sticky;
  top: 0;
  left: 0;
  z-index: 8;
  width: 82px;
  color: #35405a;
  background: #f4f3f7;
  font-weight: 700;
  box-shadow: 1px 0 0 var(--duty-line);
}

.duty-matrix__row-action-head,
.duty-matrix__row-action-cell {
  width: 34px;
  min-width: 34px;
  padding: 0;
  background: #f8f7fa;
}

.duty-matrix__row-action-head {
  position: sticky;
  top: 0;
  z-index: 6;
  border-right-color: #ddd7e4;
}

.duty-matrix__row-action-cell {
  position: relative;
  overflow: visible;
}

.duty-matrix__remove-row {
  position: absolute;
  top: 50%;
  left: 6px;
  z-index: 3;
  display: grid;
  width: 22px;
  height: 22px;
  padding: 0;
  color: #82788c;
  background: #fff;
  border: 1px solid #ddd6e4;
  border-radius: 50%;
  cursor: pointer;
  opacity: 0;
  place-items: center;
  transform: translateY(-50%);
  transition:
    color 0.15s ease,
    border-color 0.15s ease,
    opacity 0.15s ease,
    transform 0.15s ease;
}

.duty-matrix__data-row:hover .duty-matrix__remove-row,
.duty-matrix__remove-row:focus-visible {
  opacity: 1;
}

.duty-matrix__remove-row:hover {
  color: #df3d48;
  border-color: #efadb2;
}

.duty-matrix__remove-row svg {
  font-size: 9px;
}

.duty-matrix__section-head {
  position: sticky;
  top: 0;
  z-index: 5;
  height: 40px;
  color: #273149;
  background: var(--duty-indoor-tint);
  font-size: 14px;
  font-weight: 750;
  letter-spacing: 0.04em;
}

.duty-matrix__section-head.is-cleaning {
  color: #315c4c;
  background: var(--duty-cleaning-tint);
  box-shadow: inset 0 3px 0 var(--duty-cleaning-accent);
}

.duty-matrix__position-head {
  position: sticky;
  top: 40px;
  z-index: 4;
  height: 38px;
  padding: 0 6px 0 10px;
  color: #3b4660;
  background: #fbfafc;
  font-size: 12px;
  font-weight: 650;
  cursor: grab;
}

.duty-matrix__position-head.is-cleaning {
  color: #3d5f53;
  background: #f7fbf9;
}

.duty-matrix__position-head:hover {
  color: #6438b7;
  background: #f5f1fd;
}

.duty-matrix__position-head.is-cleaning:hover {
  color: #315c4c;
  background: #eef7f2;
}

.duty-matrix__position-content {
  display: flex;
  align-items: center;
  gap: 4px;
  width: 100%;
}

.duty-matrix__position-label {
  display: flex;
  flex: 1;
  align-items: center;
  justify-content: center;
  min-width: 0;
  gap: 6px;
}

.duty-matrix__position-label span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.duty-matrix__position-label svg {
  color: #aaa1b4;
  font-size: 9px;
}

.duty-matrix__position-action {
  display: grid;
  flex: none;
  width: 24px;
  height: 24px;
  padding: 0;
  color: #81798c;
  background: transparent;
  border: 0;
  border-radius: 6px;
  cursor: pointer;
  opacity: 0;
  place-items: center;
  transition:
    color 0.15s ease,
    background 0.15s ease,
    opacity 0.15s ease;
}

.duty-matrix__position-head:hover .duty-matrix__position-action,
.duty-matrix__position-action:focus-visible {
  opacity: 1;
}

.duty-matrix__position-action:hover,
.duty-matrix__position-action:focus-visible {
  color: #5d3b89;
  background: #eee8f7;
  outline: 0;
}

.duty-matrix__position-input {
  width: 100%;
  height: 29px;
  padding: 0 6px;
  color: #34284a;
  background: #fff;
  border: 1px solid var(--theme-primary);
  border-radius: 5px;
  outline: 0;
  text-align: center;
}

.duty-matrix__period-cell {
  position: sticky;
  left: 0;
  z-index: 3;
  width: 82px;
  padding: 8px;
  color: #33405d;
  background: #f8f7fa;
  font-size: 13px;
  font-weight: 750;
  white-space: nowrap;
  box-shadow: 1px 0 0 var(--duty-line);
}

.duty-matrix__data-row:nth-child(even) .duty-matrix__period-cell {
  background: #f5f4f7;
}

.duty-matrix__data-row:hover .duty-matrix__period-cell {
  color: #5c3a88;
  background: #f2eef8;
}

.duty-matrix__cell {
  height: 80px;
  padding: 6px;
  background: #fff;
  vertical-align: middle;
  transition:
    background 0.15s ease,
    box-shadow 0.15s ease;
}

.duty-matrix__cell.is-cleaning {
  background: #fbfefc;
}

.duty-matrix__data-row:nth-child(even) .duty-matrix__cell {
  background: #fafbfc;
}

.duty-matrix__data-row:nth-child(even) .duty-matrix__cell.is-cleaning {
  background: #f7fcf9;
}

.duty-matrix__data-row:hover .duty-matrix__cell {
  background: #f7f5fb;
}

.duty-matrix__data-row:hover .duty-matrix__cell.is-cleaning {
  background: #f1f8f5;
}

.duty-matrix__cell.is-drop-target {
  background: #f0eafb !important;
  box-shadow: inset 0 0 0 2px var(--theme-primary);
}

.duty-matrix__cell.is-drop-target .duty-matrix__empty {
  color: var(--theme-primary);
  border-color: color-mix(in srgb, var(--theme-primary) 45%, transparent);
}

.duty-matrix__add-row td {
  height: 34px;
  padding: 0;
  background: #fbfafc;
}

.duty-matrix__add-row button {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  width: 100%;
  height: 34px;
  padding: 0;
  color: #6b5784;
  background: transparent;
  border: 0;
  cursor: pointer;
  font-size: 12px;
  font-weight: 650;
}

.duty-matrix__add-row button:hover {
  color: #58308f;
  background: #f5f1fa;
}

.duty-matrix__add-row svg {
  font-size: 10px;
}

.duty-matrix__students {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  min-height: 28px;
  align-content: center;
}

.duty-matrix__student {
  display: flex;
  flex: 1 1 auto;
  align-items: center;
  gap: 3px;
  width: auto;
  min-width: max-content;
  max-width: 100%;
  min-height: 28px;
  padding: 0 4px;
  overflow: hidden;
  color: #34405a;
  background: #f4f5f8;
  border: 1px solid transparent;
  border-radius: 6px;
  cursor: grab;
  font-size: 12px;
  font-weight: 600;
  text-align: left;
  transition:
    color 0.15s ease,
    background 0.15s ease,
    border-color 0.15s ease,
    box-shadow 0.15s ease,
    transform 0.15s ease;
}

.duty-matrix__student:hover {
  background: #fff;
  border-color: #bcaad5;
  box-shadow: 0 3px 10px rgba(69, 50, 92, 0.1);
  transform: translateY(-1px);
}

.duty-matrix__student:focus-visible {
  border-color: var(--theme-primary);
  outline: 2px solid color-mix(in srgb, var(--theme-primary) 24%, transparent);
  outline-offset: 1px;
}

.duty-matrix__student.is-leader {
  color: #c9303b;
  background: #fff3f3;
  border-color: #f7d9db;
  font-weight: 750;
}

.duty-matrix__student-name {
  white-space: nowrap;
}

.duty-matrix__leader-dot {
  display: grid;
  flex: none;
  width: 16px;
  height: 16px;
  color: #fff;
  background: #df3d48;
  border-radius: 4px;
  font-size: 9px;
  line-height: 1;
  place-items: center;
}

.duty-matrix__student-grip {
  flex: none;
  color: #aaa1b4;
  font-size: 9px;
}

.duty-matrix__empty {
  display: grid;
  place-items: center;
  min-height: 28px;
  color: #c1bac8;
  border: 1px dashed transparent;
  border-radius: 6px;
  font-size: 10px;
}

@media (prefers-reduced-motion: reduce) {
  .duty-matrix__cell,
  .duty-matrix__position-action,
  .duty-matrix__student {
    transition: none;
  }
}

@media (hover: none) {
  .duty-matrix__position-action {
    opacity: 1;
  }
}

.duty-matrix__cell:hover .duty-matrix__empty {
  color: #8c72b5;
  border-color: #d9cceb;
}
</style>
