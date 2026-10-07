<script setup lang="ts">
import { computed, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { EnrollmentType } from '@/types/ApiWorkspace'
import type { TeachingSnapshotType } from '@/types/ApiTeaching'

const props = defineProps<{
  snapshot: TeachingSnapshotType
  busy: boolean
  ownerLabel: string
  write: (path: string, method: string, body: unknown) => Promise<void>
}>()
const selected = ref<EnrollmentType | null>(null)
const text = ref('')
let expectedVersion = 0
const page = ref(1)
const hasDraft = computed(() => Boolean(selected.value))
const comments = computed(
  () => new Map(props.snapshot.comments.map((item) => [item.studentId, item]))
)
const rows = computed(() =>
  props.snapshot.scores.students.slice((page.value - 1) * 50, page.value * 50)
)
function reset(): void {
  selected.value = null
  text.value = ''
}
function edit(student: EnrollmentType): void {
  selected.value = { ...student }
  const record = comments.value.get(student.studentId)
  expectedVersion = record?.version ?? 0
  text.value = record?.text || ''
}
async function save(): Promise<void> {
  if (!selected.value) return
  try {
    await props.write(`/workspaces/${props.snapshot.scores.workspace.id}/comments/batch`, 'PATCH', {
      items: [{ studentId: selected.value.studentId, text: text.value, expectedVersion }]
    })
    reset()
    ElMessage.success('评语已保存')
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '保存失败，草稿保留')
    console.error('保存评语失败:', error)
  }
}
async function clear(student: EnrollmentType): Promise<void> {
  try {
    await ElMessageBox.confirm(
      `确认清空「${props.ownerLabel}」${student.name} 的本期评语？`,
      '清空评语',
      { type: 'warning' }
    )
  } catch {
    return
  }
  edit(student)
  text.value = ''
  await save()
}
defineExpose({ hasDraft, reset })
</script>
<template>
  <section>
    <el-table :data="rows" row-key="studentId" border
      ><el-table-column prop="name" label="姓名" width="120" /><el-table-column label="评语"
        ><template #default="{ row }"
          ><span class="comment-editor__text">{{
            comments.get(row.studentId)?.text || '尚未填写'
          }}</span></template
        ></el-table-column
      ><el-table-column label="操作" width="180"
        ><template #default="{ row }"
          ><el-button
            text
            :disabled="busy || hasDraft || row.disabled || row.departed"
            @click="edit(row)"
            >编辑</el-button
          ><el-button
            text
            type="danger"
            :disabled="
              busy || hasDraft || row.disabled || row.departed || !comments.get(row.studentId)?.text
            "
            @click="clear(row)"
            >清空</el-button
          ></template
        ></el-table-column
      ></el-table
    >
    <el-pagination
      v-model:current-page="page"
      :page-size="50"
      :total="snapshot.scores.students.length"
      layout="total, prev, pager, next"
    />
    <el-dialog
      :model-value="!!selected"
      :title="`编辑评语：${selected?.name || ''}`"
      width="600px"
      :close-on-click-modal="false"
      :close-on-press-escape="!busy"
      :show-close="!busy"
      @close="reset"
      ><el-input
        v-model="text"
        type="textarea"
        :rows="10"
        maxlength="5000"
        show-word-limit
        :disabled="busy"
      />
      <p>评语保存到当前账号与学期；禁用和转出的学生只读。</p>
      <template #footer
        ><el-button :disabled="busy" @click="reset">取消</el-button
        ><el-button type="primary" :loading="busy" @click="save">保存</el-button></template
      ></el-dialog
    >
  </section>
</template>
<style scoped lang="scss">
.comment-editor__text {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
.el-pagination {
  margin-top: 16px;
}
</style>
