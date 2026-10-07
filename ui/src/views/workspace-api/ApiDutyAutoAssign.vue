<script setup lang="ts">
import { computed, onScopeDispose, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { autoAssignDuty, getDutyAutoSlots } from '@/utils/duty-roster/dutyAutoAssignUtil'
import { captureDutyCardCounts, reconcileDutyStructure } from '@/utils/apiClassroomInteractionUtil'
import type { DutyRosterType } from '@/types/DutyRoster'
import type { StudentSourceStudentType } from '@/types/StudentSource'
const roster = defineModel<DutyRosterType>({ required: true })
const props = defineProps<{ students: StudentSourceStudentType[] }>()
const preserve = ref(true)
const preview = ref<ReturnType<typeof autoAssignDuty> | null>(null)
const previewFingerprint = ref('')
const names = computed(() => Object.fromEntries(props.students.map((row) => [row.id, row.name])))
let alive = true
onScopeDispose(() => {
  alive = false
})
const slots = computed(() => getDutyAutoSlots(roster.value))
const previewRows = computed(() =>
  (preview.value?.assignments || []).map((row) => ({
    ...row,
    label:
      slots.value.find(
        (slot) =>
          slot.period === row.period &&
          slot.rowId === row.rowId &&
          slot.positionId === row.positionId
      )?.label || '岗位已变更'
  }))
)
const fingerprint = computed(() => JSON.stringify([roster.value, props.students, preserve.value]))
function generate(): void {
  const capacities = Object.fromEntries(
    slots.value.map((slot) => [slot.key, roster.value.autoAssignCapacities?.[slot.key] ?? 1])
  )
  preview.value = autoAssignDuty(
    roster.value,
    props.students.map((row) => row.id),
    capacities,
    preserve.value
  )
  previewFingerprint.value = fingerprint.value
}
async function apply(): Promise<void> {
  if (!preview.value || previewFingerprint.value !== fingerprint.value) {
    ElMessage.warning('设置已变更，请重新生成预览')
    return
  }
  try {
    await ElMessageBox.confirm('将预览应用到当前草稿？保存方案后才会提交服务器。', '应用值日安排', {
      type: 'warning'
    })
  } catch {
    return
  }
  if (!alive) return
  if (previewFingerprint.value !== fingerprint.value) {
    ElMessage.warning('草稿已变更，请重新生成预览')
    return
  }
  captureDutyCardCounts(roster.value)
  roster.value.assignments = JSON.parse(
    JSON.stringify(preview.value.assignments)
  ) as DutyRosterType['assignments']
  reconcileDutyStructure(roster.value)
  preview.value = null
}
function capacity(key: string, value: number | undefined): void {
  roster.value.autoAssignCapacities = { ...roster.value.autoAssignCapacities, [key]: value ?? 0 }
}
</script>
<template>
  <el-collapse-item title="自动分配容量与预览">
    <el-checkbox v-model="preserve">保留既有安排，补齐空缺</el-checkbox>
    <el-table :data="slots" border
      ><el-table-column prop="label" label="岗位格" />
      <el-table-column label="容量"
        ><template #default="{ row }"
          ><el-input-number
            :model-value="roster.autoAssignCapacities?.[row.key] ?? 1"
            :min="0"
            :max="100"
            @change="capacity(row.key, $event)" /></template
      ></el-table-column>
    </el-table>
    <div class="duty-board__actions">
      <el-button @click="generate">生成预览</el-button
      ><el-button :disabled="!preview || previewFingerprint !== fingerprint" @click="apply"
        >应用到草稿</el-button
      >
      <span v-if="preview"
        >未安排 {{ preview.unassigned.length }} 张卡片，空缺 {{ preview.vacancies }} 个</span
      >
    </div>
    <el-table v-if="preview" :data="previewRows"
      ><el-table-column prop="label" label="时段 / 岗位" /><el-table-column label="学生"
        ><template #default="{ row }">{{
          row.studentIds.map((id: string) => names[id]).join('、')
        }}</template></el-table-column
      ></el-table
    >
  </el-collapse-item>
</template>
<style scoped lang="scss">
.duty-board__actions {
  display: flex;
  gap: 12px;
  align-items: center;
  margin: 12px 0;
}
</style>
