<script setup lang="ts">
import { computed, ref } from 'vue'
import type { WorkspaceRecordType } from '@/types/ApiWorkspace'

const props = defineProps<{
  busy: boolean
  mutate: (path: string, method: string, body: unknown) => Promise<void>
}>()
const opened = ref(false)
const mode = ref<'create' | 'edit' | 'promote'>('create')
const source = ref<WorkspaceRecordType | null>(null)
const className = ref('')
const termName = ref('')
const fullMark = ref(100)
const inheritStudents = ref(true)
const inheritAssessments = ref(true)
const hasDraft = computed(() => opened.value)
function reset(): void {
  opened.value = false
}
function open(value: typeof mode.value, workspace: WorkspaceRecordType | null): void {
  mode.value = value
  source.value = workspace ? { ...workspace } : null
  className.value = value === 'create' ? '' : workspace?.className || ''
  termName.value = value === 'edit' ? workspace?.termName || '' : ''
  fullMark.value = value === 'create' ? 100 : workspace?.scoreFullMark || 100
  inheritStudents.value = true
  inheritAssessments.value = true
  opened.value = true
}
async function save(): Promise<void> {
  const body = { className: className.value, termName: termName.value }
  try {
    if (mode.value === 'create')
      await props.mutate('/workspaces', 'POST', { ...body, scoreFullMark: fullMark.value })
    else if (source.value)
      await props.mutate(
        `/workspaces/${source.value.id}${mode.value === 'promote' ? '/promote' : ''}`,
        mode.value === 'promote' ? 'POST' : 'PATCH',
        {
          ...body,
          version: source.value.version,
          ...(mode.value === 'edit'
            ? { scoreFullMark: fullMark.value }
            : {
                inheritStudents: inheritStudents.value,
                inheritAssessments: inheritAssessments.value
              })
        }
      )
    reset()
  } catch (error) {
    console.error('保存班级学期失败:', error)
  }
}
defineExpose({ hasDraft, reset, open })
</script>
<template>
  <el-dialog
    v-model="opened"
    :title="mode === 'create' ? '新建班级学期' : mode === 'edit' ? '编辑班级学期' : '进入新学期'"
    width="460px"
    :close-on-click-modal="false"
    :close-on-press-escape="!busy"
    :show-close="!busy"
  >
    <el-form label-width="80px" :disabled="busy"
      ><el-form-item label="班级名称"><el-input v-model="className" maxlength="60" /></el-form-item
      ><el-form-item label="学期名称"><el-input v-model="termName" maxlength="60" /></el-form-item
      ><el-form-item v-if="mode !== 'promote'" label="默认满分"
        ><el-input-number v-model="fullMark" :min="0.01" :max="100000" /></el-form-item
      ><el-form-item v-if="mode === 'promote'"
        ><el-checkbox v-model="inheritStudents">沿用未转出的名单（不复制成绩和评语）</el-checkbox
        ><el-checkbox v-model="inheritAssessments"
          >沿用测评配置（不复制成绩）</el-checkbox
        ></el-form-item
      ></el-form
    >
    <template #footer
      ><el-button :disabled="busy" @click="reset">取消</el-button
      ><el-button
        type="primary"
        :loading="busy"
        :disabled="!className.trim() || !termName.trim()"
        @click="save"
        >保存</el-button
      ></template
    >
  </el-dialog>
</template>
