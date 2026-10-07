<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ElMessageBox } from 'element-plus'
import { DutyRosterModeEnum } from '@/types/DutyRoster'
import ApiDutyBoard from './ApiDutyBoard.vue'
import { captureDutyCardCounts, reconcileDutyStructure } from '@/utils/apiClassroomInteractionUtil'
import { getDutyAutoSlots } from '@/utils/duty-roster/dutyAutoAssignUtil'
import { createDutyPosition, createDutyWeeklyRow } from '@/utils/duty-roster/dutyRosterUtil'
import type { DutyRosterType, DutySectionType } from '@/types/DutyRoster'
import type { StudentSourceStudentType } from '@/types/StudentSource'

const props = defineProps<{ roster: DutyRosterType; students: StudentSourceStudentType[] }>()
const emit = defineEmits<{ 'update:roster': [value: DutyRosterType] }>()
/** 子编辑器使用局部草稿，修改通过事件交还父页面，不直接改传入属性。 */
const roster = ref<DutyRosterType>(JSON.parse(JSON.stringify(props.roster)) as DutyRosterType)
watch(roster, (value) => emit('update:roster', value), { deep: true, immediate: true })
watch(
  () => props.roster,
  (value) => {
    if (value !== roster.value) roster.value = JSON.parse(JSON.stringify(value)) as DutyRosterType
  }
)
const slots = computed(() => getDutyAutoSlots(roster.value))
function ids(key: string): string[] {
  const slot = slots.value.find((item) => item.key === key)!
  return (
    roster.value.assignments.find(
      (row) =>
        row.period === slot.period && row.rowId === slot.rowId && row.positionId === slot.positionId
    )?.studentIds || []
  )
}
function assign(key: string, studentIds: string[]): void {
  const slot = slots.value.find((item) => item.key === key)!
  captureDutyCardCounts(roster.value)
  roster.value.assignments = roster.value.assignments.filter(
    (row) =>
      !(
        row.period === slot.period &&
        row.rowId === slot.rowId &&
        row.positionId === slot.positionId
      )
  )
  if (studentIds.length)
    roster.value.assignments.push({
      period: slot.period,
      rowId: slot.rowId,
      positionId: slot.positionId,
      studentIds
    })
  reconcileDutyStructure(roster.value)
}
async function modeChange(mode: DutyRosterModeEnum): Promise<void> {
  if (mode === roster.value.mode) return
  try {
    await ElMessageBox.confirm('切换排班模式会清空当前草稿中的分配和组长，继续？', '切换模式', {
      type: 'warning'
    })
  } catch {
    return
  }
  captureDutyCardCounts(roster.value)
  roster.value.mode = mode
  roster.value.assignments = []
  roster.value.leaders = []
  reconcileDutyStructure(roster.value)
}
async function removeSection(section: DutySectionType): Promise<void> {
  try {
    await ElMessageBox.confirm(`删除区域“${section.name}”及其草稿安排？`, '删除区域', {
      type: 'warning'
    })
  } catch {
    return
  }
  const positions = new Set(section.positions.map((position) => position.id))
  roster.value.sections = roster.value.sections.filter((row) => row.id !== section.id)
  captureDutyCardCounts(roster.value)
  roster.value.assignments = roster.value.assignments.filter(
    (row) => !positions.has(row.positionId)
  )
  roster.value.leaders = roster.value.leaders.filter((row) => row.sectionId !== section.id)
  reconcileDutyStructure(roster.value)
}
async function removePosition(section: DutySectionType, id: string): Promise<void> {
  try {
    await ElMessageBox.confirm('删除岗位及其草稿安排？', '删除岗位', { type: 'warning' })
  } catch {
    return
  }
  section.positions = section.positions.filter((row) => row.id !== id)
  captureDutyCardCounts(roster.value)
  roster.value.assignments = roster.value.assignments.filter((row) => row.positionId !== id)
}
function addSection(): void {
  roster.value.sections.push({
    id: crypto.randomUUID(),
    name: '新区域',
    kind: 'cleaning',
    sortOrder: roster.value.sections.length,
    positions: [createDutyPosition('新岗位', 0)]
  })
}
</script>

<template>
  <div>
    <div class="duty-editor__toolbar">
      <el-radio-group :model-value="roster.mode" @change="modeChange($event as DutyRosterModeEnum)">
        <el-radio-button :value="DutyRosterModeEnum.Daily">按天</el-radio-button>
        <el-radio-button :value="DutyRosterModeEnum.Weekly">按周</el-radio-button>
      </el-radio-group>
      <el-button @click="addSection">增加区域</el-button>
      <el-button
        v-if="roster.mode === 'weekly'"
        :disabled="roster.weeklyRows.length >= 50"
        @click="roster.weeklyRows.push(createDutyWeeklyRow(roster.weeklyRows.length))"
        >增加周表组</el-button
      >
    </div>
    <div v-for="section in roster.sections" :key="section.id" class="duty-editor__section">
      <div class="duty-editor__toolbar">
        <el-input v-model="section.name" maxlength="120" placeholder="区域名称" />
        <el-select
          v-model="section.leaderStudentId"
          clearable
          filterable
          placeholder="区域大组长"
          @clear="delete section.leaderStudentId"
        >
          <el-option
            v-for="student in students"
            :key="student.id"
            :value="student.id"
            :label="student.name"
          />
        </el-select>
        <el-button
          @click="section.positions.push(createDutyPosition('新岗位', section.positions.length))"
          >增加岗位</el-button
        >
        <el-button type="danger" text @click="removeSection(section)">删除区域</el-button>
      </div>
      <div v-for="position in section.positions" :key="position.id" class="duty-editor__toolbar">
        <el-input v-model="position.name" maxlength="120" placeholder="岗位名称" />
        <el-button type="danger" text @click="removePosition(section, position.id)"
          >删除岗位</el-button
        >
      </div>
    </div>
    <ApiDutyBoard
      v-model="roster"
      :students="students"
      @remove-position="
        (id) => {
          const section = roster.sections.find((row) =>
            row.positions.some((position) => position.id === id)
          )
          if (section) removePosition(section, id)
        }
      "
      @add-position="
        (id) => {
          const section = roster.sections.find((row) => row.id === id)
          if (section && section.positions.length < 100)
            section.positions.push(createDutyPosition('新岗位', section.positions.length))
        }
      "
    />
    <el-collapse
      ><el-collapse-item title="按岗位精确选择学生">
        <el-table :data="slots" border>
          <el-table-column prop="label" label="时段 / 岗位" min-width="250" />
          <el-table-column label="安排学生" min-width="300">
            <template #default="{ row }">
              <el-select
                :model-value="ids(row.key)"
                multiple
                filterable
                @change="assign(row.key, $event)"
              >
                <el-option
                  v-for="student in students"
                  :key="student.id"
                  :value="student.id"
                  :label="student.name"
                />
              </el-select>
            </template>
          </el-table-column>
        </el-table> </el-collapse-item
    ></el-collapse>
  </div>
</template>

<style scoped lang="scss">
.duty-editor {
  &__toolbar {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
    margin: 12px 0;
    .el-input {
      width: 220px;
    }
  }
  &__section {
    border: 1px solid var(--el-border-color);
    padding: 12px;
    margin-bottom: 12px;
    border-radius: 6px;
  }
}
.el-select {
  min-width: 240px;
}
</style>
