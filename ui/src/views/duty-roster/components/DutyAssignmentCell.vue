<script setup lang="ts">
/** 值日分配单元格：展示学生卡片和目标反馈，向矩阵转发拖拽与菜单事件。 */
import type { DutyAssignmentTargetType } from '@/types/DutyRoster'

defineProps<{
  target: DutyAssignmentTargetType
  studentIds: string[]
  studentNames: Record<string, string>
  leaderIds: string[]
  cleaning: boolean
  dropTarget: boolean
}>()

const emit = defineEmits<{
  dragEnter: [event: DragEvent]
  dragLeave: [event: DragEvent]
  dropStudent: [target: DutyAssignmentTargetType]
  dragStudentStart: [studentId: string, target: DutyAssignmentTargetType]
  dragStudentEnd: []
  studentContext: [event: MouseEvent, studentId: string, target: DutyAssignmentTargetType]
}>()
</script>

<template>
  <td
    class="duty-matrix__cell"
    :class="{
      'is-cleaning': cleaning,
      'is-drop-target': dropTarget
    }"
    @dragover.prevent
    @dragenter.prevent="emit('dragEnter', $event)"
    @dragleave="emit('dragLeave', $event)"
    @drop.prevent="emit('dropStudent', target)"
  >
    <div class="duty-matrix__students">
      <button
        v-for="studentId in studentIds"
        :key="studentId"
        class="duty-matrix__student"
        :class="{ 'is-leader': leaderIds.includes(studentId) }"
        type="button"
        draggable="true"
        :aria-label="`${studentNames[studentId] || '未知学生'}${
          leaderIds.includes(studentId) ? '，组长' : ''
        }`"
        :title="`${studentNames[studentId] || '未知学生'}｜拖动调整岗位，右键查看更多操作`"
        @dragstart.stop="emit('dragStudentStart', studentId, target)"
        @dragend="emit('dragStudentEnd')"
        @contextmenu="emit('studentContext', $event, studentId, target)"
      >
        <span
          v-if="leaderIds.includes(studentId)"
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
      <span v-if="!studentIds.length" class="duty-matrix__empty"> 拖入学生 </span>
    </div>
  </td>
</template>

<style scoped lang="scss">
.duty-matrix__cell.is-drop-target .duty-matrix__empty {
  color: var(--theme-primary);
  border-color: color-mix(in srgb, var(--theme-primary) 45%, transparent);
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

.duty-matrix__cell:hover .duty-matrix__empty {
  color: #8c72b5;
  border-color: #d9cceb;
}
@media (prefers-reduced-motion: reduce) {
  .duty-matrix__student {
    transition: none;
  }
}
</style>
