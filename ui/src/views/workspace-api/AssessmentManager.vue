<script setup lang="ts">
import { computed, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { AssessmentType } from '@/types/ApiScores'

const props = defineProps<{
  items: AssessmentType[]
  workspaceId: string
  ownerLabel: string
  busy: boolean
  write: (path: string, method: string, body: unknown) => Promise<void>
}>()
const opened = ref(false)
const editing = ref<AssessmentType | null>(null)
const label = ref('')
const fullMark = ref<number | undefined>()
const disabled = ref(false)
const sortIndex = ref(0)
const hasDraft = computed(() => opened.value)
function reset(): void {
  opened.value = false
}
function open(item?: AssessmentType): void {
  editing.value = item ? { ...item } : null
  label.value = item?.label || ''
  fullMark.value = item?.fullMark ?? undefined
  disabled.value = item?.disabled ?? false
  sortIndex.value = item?.sortIndex ?? props.items.length
  opened.value = true
}
async function save(): Promise<void> {
  const path = `/workspaces/${props.workspaceId}/assessments`
  const body = {
    label: label.value,
    fullMark: fullMark.value ?? null,
    disabled: disabled.value,
    sortIndex: sortIndex.value
  }
  try {
    await props.write(
      editing.value ? `${path}/${editing.value.id}` : path,
      editing.value ? 'PATCH' : 'POST',
      editing.value ? { ...body, version: editing.value.version } : body
    )
    reset()
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '保存测评失败')
    console.error('测评保存失败:', error)
  }
}
async function remove(item: AssessmentType): Promise<void> {
  try {
    await ElMessageBox.confirm(
      `将在「${props.ownerLabel}」软删除测评 ${item.label}，成绩仍保留。被其他学期参照时无法删除。`,
      '删除测评',
      { type: 'warning' }
    )
  } catch {
    return
  }
  try {
    await props.write(`/workspaces/${props.workspaceId}/assessments/${item.id}`, 'DELETE', {
      version: item.version
    })
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '删除失败')
    console.error('删除测评失败:', error)
  }
}
defineExpose({ hasDraft, reset })
</script>
<template>
  <section>
    <el-button :disabled="busy" @click="open()">新增测评列</el-button>
    <el-table :data="items" row-key="id" size="small">
      <el-table-column prop="label" label="测评名称" /><el-table-column label="满分"
        ><template #default="{ row }">{{
          row.fullMark ?? '沿用学期满分'
        }}</template></el-table-column
      ><el-table-column label="状态"
        ><template #default="{ row }">{{
          row.disabled ? '禁用' : '启用'
        }}</template></el-table-column
      ><el-table-column prop="sortIndex" label="排序" /><el-table-column label="操作"
        ><template #default="{ row }"
          ><el-button text :disabled="busy" @click="open(row)">编辑</el-button
          ><el-button text type="danger" :disabled="busy" @click="remove(row)"
            >删除</el-button
          ></template
        ></el-table-column
      >
    </el-table>
    <el-dialog
      v-model="opened"
      :title="editing ? '编辑测评' : '新增测评'"
      width="440px"
      :close-on-click-modal="false"
      :close-on-press-escape="!busy"
      :show-close="!busy"
    >
      <el-form label-width="80px" :disabled="busy"
        ><el-form-item label="名称"><el-input v-model="label" maxlength="60" /></el-form-item
        ><el-form-item label="满分"
          ><el-input-number
            v-model="fullMark"
            :min="0.01"
            :max="100000"
            placeholder="空值沿用学期满分" /></el-form-item
        ><el-form-item label="排序"
          ><el-input-number
            v-model="sortIndex"
            :min="0"
            :max="10000"
            :precision="0" /></el-form-item
        ><el-form-item
          ><el-checkbox v-model="disabled">禁用测评</el-checkbox></el-form-item
        ></el-form
      >
      <template #footer
        ><el-button :disabled="busy" @click="reset">取消</el-button
        ><el-button type="primary" :disabled="!label.trim() || busy" @click="save"
          >保存</el-button
        ></template
      >
    </el-dialog>
  </section>
</template>
