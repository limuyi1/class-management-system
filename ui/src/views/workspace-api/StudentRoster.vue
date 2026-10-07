<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { apiRequest } from '@/api/client'
import { ElMessageBox } from 'element-plus'
import type { EnrollmentType, WorkspaceRecordType } from '@/types/ApiWorkspace'

const props = defineProps<{
  students: EnrollmentType[]
  workspace: WorkspaceRecordType
  catalog: WorkspaceRecordType[]
  ownerLabel: string
  busy: boolean
  mutate: (path: string, method: string, body: unknown) => Promise<void>
}>()
const historical = ref<EnrollmentType[]>([]),
  historicalId = ref('')
watch(
  () => props.workspace.id,
  async (id) => {
    historical.value = []
    const owner = props.workspace.ownerId
    try {
      const data = await apiRequest<{ items: EnrollmentType[] }>('/students/history', {
        ownerId: owner
      })
      if (id === props.workspace.id && owner === props.workspace.ownerId)
        historical.value = data.items.filter(
          (item) => !props.students.some((row) => row.studentId === item.studentId)
        )
    } catch (error) {
      console.error('读取历史身份失败:', error)
    }
  },
  { immediate: true }
)
const name = ref('')
const editing = ref<EnrollmentType | null>(null)
const disabled = ref(false)
const departed = ref(false)
const targetId = ref('')
const hasDraft = computed(() => Boolean(name.value || editing.value || targetId.value))
const targets = computed(() =>
  props.catalog.filter(
    (item) => item.classId !== props.workspace.classId && item.termName === props.workspace.termName
  )
)

/** 草稿留在当前账号/学期内，成功提交后才清空，失败允许使用原幂等键重试。 */
function reset(): void {
  name.value = ''
  historicalId.value = ''
  editing.value = null
  disabled.value = false
  departed.value = false
  targetId.value = ''
}
function edit(student: EnrollmentType): void {
  editing.value = { ...student }
  name.value = student.name
  disabled.value = student.disabled
  departed.value = student.departed
}
async function save(): Promise<void> {
  const base = `/workspaces/${props.workspace.id}/students`
  await props.mutate(
    editing.value ? `${base}/${editing.value.studentId}` : base,
    editing.value ? 'PATCH' : 'POST',
    editing.value
      ? {
          name: name.value,
          disabled: disabled.value,
          departed: departed.value,
          version: editing.value.version
        }
      : { name: name.value, ...(historicalId.value ? { studentId: historicalId.value } : {}) }
  )
  reset()
}
async function remove(student: EnrollmentType): Promise<void> {
  try {
    await ElMessageBox.confirm(
      `将在「${props.ownerLabel} / ${props.workspace.className} / ${props.workspace.termName}」软删除 ${student.name}，历史数据仍保留。`,
      '删除学生',
      { type: 'warning' }
    )
  } catch {
    return
  }
  await props.mutate(`/workspaces/${props.workspace.id}/students/${student.studentId}`, 'DELETE', {
    version: student.version
  })
  if (editing.value?.studentId === student.studentId) reset()
}
async function transfer(): Promise<void> {
  if (!editing.value || !targetId.value) return
  try {
    await ElMessageBox.confirm(
      `确认将 ${editing.value.name} 转到所选班级？来源学期保留转出记录。`,
      '转班确认',
      { type: 'warning' }
    )
  } catch {
    return
  }
  await props.mutate(`/workspaces/${props.workspace.id}/transfers`, 'POST', {
    studentId: editing.value.studentId,
    targetId: targetId.value,
    version: editing.value.version
  })
  reset()
}
// 模板事件捕获错误，父级统一展示消息；保留编辑草稿以便处理网络故障。
async function handle(action: () => Promise<void>): Promise<void> {
  try {
    await action()
  } catch (error) {
    console.error('名单操作失败:', error)
  }
}
defineExpose({ hasDraft, reset })
</script>

<template>
  <section>
    <el-form inline :disabled="busy">
      <el-form-item :label="editing ? '编辑学生' : '新增学生'"
        ><el-input v-model="name" maxlength="60" placeholder="学生姓名"
      /></el-form-item>
      <el-form-item v-if="!editing" label="沿用历史学生"
        ><el-select
          v-model="historicalId"
          clearable
          filterable
          @change="name = historical.find((row) => row.studentId === historicalId)?.name || name"
          ><el-option
            v-for="row in historical"
            :key="row.studentId"
            :value="row.studentId"
            :label="`${row.name} · ${row.studentId.slice(0, 8)}`" /></el-select
      ></el-form-item>
      <template v-if="editing">
        <el-form-item
          ><el-checkbox v-model="disabled">禁用</el-checkbox
          ><el-checkbox v-model="departed">已转出</el-checkbox></el-form-item
        >
      </template>
      <el-form-item
        ><el-button type="primary" :disabled="!name.trim()" :loading="busy" @click="handle(save)"
          >保存</el-button
        ><el-button @click="reset">取消编辑</el-button></el-form-item
      >
      <template v-if="editing && !editing.departed && targets.length">
        <el-form-item label="转到"
          ><el-select v-model="targetId" placeholder="同学期其他班级"
            ><el-option
              v-for="item in targets"
              :key="item.id"
              :label="item.className"
              :value="item.id" /></el-select
        ></el-form-item>
        <el-form-item
          ><el-button :disabled="!targetId" @click="handle(transfer)"
            >确认转班</el-button
          ></el-form-item
        >
      </template>
    </el-form>
    <el-table :data="students" row-key="studentId" border>
      <el-table-column type="index" width="60" label="序号" />
      <el-table-column prop="name" label="姓名" />
      <el-table-column label="状态"
        ><template #default="{ row }">{{
          row.departed ? '已转出' : row.disabled ? '已禁用' : '正常'
        }}</template></el-table-column
      >
      <el-table-column label="操作" width="180"
        ><template #default="{ row }"
          ><el-button text :disabled="busy || hasDraft" @click="edit(row)">编辑</el-button
          ><el-button
            text
            type="danger"
            :disabled="busy || hasDraft"
            @click="handle(() => remove(row))"
            >删除</el-button
          ></template
        ></el-table-column
      >
    </el-table>
  </section>
</template>

<style scoped lang="scss">
.el-select {
  width: 180px;
}
</style>
