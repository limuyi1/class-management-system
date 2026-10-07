<script setup lang="ts">
import { computed, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import draggable from 'vuedraggable'
import DutyScheduleMatrix from '@/views/duty-roster/components/DutyScheduleMatrix.vue'
import {
  assignDutyStudent,
  moveDutyStudent,
  removeDutyStudentAssignment,
  toggleDutyLeader
} from '@/utils/duty-roster/dutyRosterAssignmentUtil'
import {
  getDutyStudentCardCount,
  getDutyStudentAssignmentCount,
  getDutyPendingStudentCount,
  createDutyWeeklyRow
} from '@/utils/duty-roster/dutyRosterUtil'
import ApiDutyAutoAssign from './ApiDutyAutoAssign.vue'
import {
  setDutyCardCount,
  captureDutyCardCounts,
  reconcileDutyStructure,
  removeDutyWeeklyRow
} from '@/utils/apiClassroomInteractionUtil'
import type { DutyRosterType, DutyAssignmentTargetType } from '@/types/DutyRoster'
import type { StudentSourceStudentType } from '@/types/StudentSource'
import type { DraggedStudentType } from '@/types/DutyRosterInteraction'

const emit = defineEmits<{ removePosition: [id: string]; addPosition: [sectionId: string] }>()
const leaderSectionId = ref('')
const positionId = ref('')
const roster = defineModel<DutyRosterType>({ required: true })
const props = defineProps<{ students: StudentSourceStudentType[] }>()
const dragged = ref<DraggedStudentType | null>(null)
const selection = ref<DraggedStudentType | null>(null)
const leaderSection = computed(() =>
  roster.value.sections.find((section) => section.id === leaderSectionId.value)
)
const positionSection = computed(() =>
  roster.value.sections.find((section) =>
    section.positions.some((position) => position.id === positionId.value)
  )
)
const names = computed(() => Object.fromEntries(props.students.map((row) => [row.id, row.name])))
function count(id: string, value: number | undefined): void {
  try {
    setDutyCardCount(roster.value, id, value ?? 1)
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '卡片数无效')
  }
}
function drop(target: DutyAssignmentTargetType): void {
  const card = dragged.value
  if (!card || !props.students.some((student) => student.id === card.studentId)) return
  captureDutyCardCounts(roster.value)
  if (card.source) moveDutyStudent(roster.value, card.studentId, card.source, target)
  else assignDutyStudent(roster.value, card.studentId, target)
  reconcileDutyStructure(roster.value)
  dragged.value = null
}
function recycle(): void {
  captureDutyCardCounts(roster.value)
  if (dragged.value?.source)
    removeDutyStudentAssignment(roster.value, dragged.value.studentId, dragged.value.source)
  dragged.value = null
}
function copyCard(): void {
  if (!selection.value) return
  const id = selection.value.studentId
  count(id, getDutyStudentCardCount(roster.value, id) + 1)
}
function removeCard(): void {
  if (!selection.value?.source) return
  captureDutyCardCounts(roster.value)
  removeDutyStudentAssignment(roster.value, selection.value.studentId, selection.value.source)
  selection.value = null
}
function leader(): void {
  if (!selection.value?.source) return
  toggleDutyLeader(roster.value, selection.value.studentId, selection.value.source)
}
async function removeWeek(id: string): Promise<void> {
  try {
    await ElMessageBox.confirm('删除此周表组及其安排和组长？', '删除周表组', { type: 'warning' })
  } catch {
    return
  }
  removeDutyWeeklyRow(roster.value, id)
}
function requestRemovePosition(): void {
  emit('removePosition', positionId.value)
  positionId.value = ''
}
function renamePosition(id: string, name: string): void {
  const position = roster.value.sections
    .flatMap((section) => section.positions)
    .find((row) => row.id === id)
  if (position) position.name = name
}
function reorder(sectionId: string, sourceId: string, targetId: string): void {
  const section = roster.value.sections.find((row) => row.id === sectionId)
  if (!section) return
  const positions = [...section.positions].sort((a, b) => a.sortOrder - b.sortOrder)
  const source = positions.find((row) => row.id === sourceId)
  if (!source || sourceId === targetId) return
  const ordered = positions.filter((row) => row.id !== sourceId)
  const index = ordered.findIndex((row) => row.id === targetId)
  if (index < 0) return
  ordered.splice(index, 0, source)
  ordered.forEach((row, sortOrder) => {
    row.sortOrder = sortOrder
  })
  section.positions = ordered
}
</script>
<template>
  <section>
    <p>拖动卡片安排岗位；表格内拖动可换岗，拖回待选区可回收。右键已安排卡片设置组长或复制。</p>
    <div v-if="selection" class="duty-board__actions">
      <strong>{{ names[selection.studentId] }}</strong>
      <el-button @click="copyCard">复制卡片</el-button>
      <el-button v-if="selection.source" @click="leader">设置 / 取消时段组长</el-button>
      <el-button v-if="selection.source" @click="removeCard">回收到待选区</el-button>
      <el-button @click="selection = null">关闭</el-button>
    </div>
    <div v-if="leaderSection" class="duty-board__actions">
      <strong>{{ leaderSection.name }}的大组长</strong>
      <el-select
        v-model="leaderSection.leaderStudentId"
        clearable
        filterable
        @clear="delete leaderSection.leaderStudentId"
      >
        <el-option
          v-for="student in students"
          :key="student.id"
          :value="student.id"
          :label="student.name"
        />
      </el-select>
      <el-button @click="leaderSectionId = ''">关闭</el-button>
    </div>
    <div v-if="positionSection" class="duty-board__actions">
      <span
        >当前岗位：{{ positionSection.positions.find((row) => row.id === positionId)?.name }}</span
      >
      <el-button @click="emit('addPosition', positionSection.id)">增加同区域岗位</el-button>
      <el-button type="danger" @click="requestRemovePosition">删除岗位</el-button>
      <el-button @click="positionId = ''">关闭</el-button>
    </div>
    <div class="duty-board__workspace">
      <DutyScheduleMatrix
        :roster="roster"
        :student-names="names"
        @drag-student-start="(studentId, source) => (dragged = { studentId, source })"
        @drag-student-end="dragged = null"
        @drop-student="drop"
        @student-context="(studentId, source) => (selection = { studentId, source })"
        @edit-section-leader="leaderSectionId = $event"
        @position-context="positionId = $event"
        @rename-position="renamePosition"
        @reorder-position="reorder"
        @add-weekly-row="
          roster.weeklyRows.length < 50 &&
          roster.weeklyRows.push(createDutyWeeklyRow(roster.weeklyRows.length))
        "
        @remove-weekly-row="removeWeek"
      />
      <el-scrollbar class="app-scroll-region" max-height="600px"
        ><aside @dragover.prevent @drop.prevent="recycle">
          <h4>待选卡片与数量</h4>
          <div v-for="student in students" :key="student.id" class="duty-board__card">
            <button
              type="button"
              :draggable="getDutyPendingStudentCount(roster, student.id) > 0"
              @dragstart="dragged = { studentId: student.id }"
              @dragend="dragged = null"
              @click="selection = { studentId: student.id }"
            >
              {{ student.name }} · 待选 {{ getDutyPendingStudentCount(roster, student.id) }}
            </button>
            <el-input-number
              :model-value="getDutyStudentCardCount(roster, student.id)"
              :min="Math.max(1, getDutyStudentAssignmentCount(roster, student.id))"
              :max="100"
              size="small"
              :aria-label="`${student.name}的卡片总数`"
              @change="count(student.id, $event)"
            />
          </div></aside
      ></el-scrollbar>
    </div>
    <el-collapse>
      <el-collapse-item v-if="roster.mode === 'weekly'" title="周表组排序与删除">
        <draggable
          v-model="roster.weeklyRows"
          item-key="id"
          handle=".duty-board__handle"
          @end="roster.weeklyRows.forEach((row, index) => (row.sortOrder = index))"
        >
          <template #item="{ element, index }"
            ><div class="duty-board__actions">
              <span class="duty-board__handle">↕ 第 {{ index + 1 }} 组</span
              ><el-button type="danger" text @click="removeWeek(element.id)">删除组</el-button>
            </div></template
          >
        </draggable>
      </el-collapse-item>
      <ApiDutyAutoAssign v-model="roster" :students="students" />
    </el-collapse>
  </section>
</template>
<style scoped lang="scss">
.duty-board {
  &__workspace {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 260px;
    gap: 16px;
    aside {
      overflow: visible;
      background: var(--el-fill-color-light);
      padding: 12px;
    }
  }
  &__actions {
    display: flex;
    gap: 12px;
    align-items: center;
    margin: 12px 0;
  }
  &__card {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin-bottom: 12px;
    button {
      background: var(--el-bg-color);
      border: 1px solid var(--el-border-color);
      border-radius: 4px;
      padding: 8px;
      cursor: grab;
    }
  }
  &__handle {
    cursor: grab;
  }
}
</style>
