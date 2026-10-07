<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import { ElMessage } from 'element-plus'

import { useDutyRosterStore } from '@/stores/duty-roster'
import { autoAssignDuty, getDutyAutoSlots } from '@/utils/duty-roster/dutyAutoAssignUtil'
import { getDutyStudentCardCount } from '@/utils/duty-roster/dutyRosterUtil'

const visible = defineModel<boolean>({ required: true })
const store = useDutyRosterStore()
const capacities = ref<Record<string, number>>({})
const preserve = ref(true)
const result = ref<ReturnType<typeof autoAssignDuty> | null>(null)
const slots = computed(() => (store.editingRoster ? getDutyAutoSlots(store.editingRoster) : []))
const names = computed(() =>
  Object.fromEntries(store.activeStudents.map((student) => [student.id, student.name]))
)
const capacity = computed(() => Object.values(capacities.value).reduce((a, b) => a + (b || 0), 0))
const available = computed(() =>
  store.editingRoster
    ? store.activeStudents.reduce(
        (sum, student) => sum + getDutyStudentCardCount(store.editingRoster!, student.id),
        0
      )
    : 0
)
const rows = computed(() =>
  slots.value.map((slot) => ({
    ...slot,
    students:
      result.value?.assignments
        .find(
          (item) =>
            item.period === slot.period &&
            item.rowId === slot.rowId &&
            item.positionId === slot.positionId
        )
        ?.studentIds.map((id) => names.value[id])
        .join('、') || ''
  }))
)
watch(
  [capacities, preserve],
  () => {
    result.value = null
  },
  { deep: true }
)
watch(visible, (value) => {
  if (!value) return
  result.value = null
  preserve.value = true
  const saved = store.editingRoster?.autoAssignCapacities
  capacities.value = Object.fromEntries(
    slots.value.map((slot, index) => [
      slot.key,
      saved?.[slot.key] ??
        Math.floor(available.value / Math.max(1, slots.value.length)) +
          (index < available.value % Math.max(1, slots.value.length) ? 1 : 0)
    ])
  )
})

/** 每次生成仅更新弹窗预览。 */
function generate(): void {
  if (store.editingRoster)
    result.value = autoAssignDuty(
      store.editingRoster,
      store.activeStudents.map((student) => student.id),
      capacities.value,
      preserve.value
    )
}

/** 保存为独立固定安排，保留原表便于回退。 */
function apply(): void {
  if (!store.editingRoster || !result.value) return
  const generated = JSON.parse(
    JSON.stringify(result.value.assignments)
  ) as typeof result.value.assignments
  const name = `${store.editingRoster.name} · 自动安排`
  store.copyRoster(store.editingRoster.id)
  const roster = store.editingRoster
  roster.name = name
  roster.assignments = generated
  roster.autoAssignCapacities = { ...capacities.value }
  roster.leaders = roster.leaders.filter((leader) =>
    generated.some(
      (item) =>
        item.period === leader.period &&
        item.rowId === leader.rowId &&
        item.studentIds.includes(leader.studentId) &&
        roster.sections
          .find((section) => section.id === leader.sectionId)
          ?.positions.some((position) => position.id === item.positionId)
    )
  )
  visible.value = false
  ElMessage.success('已生成固定值日安排，可继续拖拽微调')
}
</script>

<template>
  <el-dialog v-model="visible" title="自动分配值日岗位" width="900px" append-to-body>
    <p>
      设置每个岗位格需要的人数，生成后整学期固定使用。共 {{ available }} 张学生卡片，岗位容量
      {{ capacity }}。
    </p>
    <el-checkbox v-model="preserve"
      >保留已安排学生，只补充空缺（已安排人数超过容量时仍保留）</el-checkbox
    >
    <el-table :data="rows" height="420">
      <el-table-column prop="label" label="值日时段 / 岗位" min-width="250" />
      <el-table-column label="需要人数" width="170"
        ><template #default="{ row }"
          ><el-input-number
            v-model="capacities[row.key]"
            :min="0"
            :max="100"
            size="small" /></template
      ></el-table-column>
      <el-table-column prop="students" label="分配预览" min-width="220" />
    </el-table>
    <el-alert
      v-if="result"
      :closable="false"
      :type="result.vacancies || result.unassigned.length ? 'warning' : 'success'"
      :title="`未满岗位名额 ${result.vacancies}；未安排卡片 ${result.unassigned.length}${result.unassigned.length ? `：${result.unassigned.map((id) => names[id]).join('、')}` : ''}`"
    />
    <template #footer
      ><el-button @click="visible = false">取消</el-button
      ><el-button @click="generate">{{ result ? '重新生成' : '生成预览' }}</el-button
      ><el-button type="primary" :disabled="!result" @click="apply"
        >保存为新方案</el-button
      ></template
    >
  </el-dialog>
</template>
