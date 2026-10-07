<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { apiRequest } from '@/api/client'
import { useScopedApiResource } from '@/hooks/api/useScopedApiResource'
import type { ResourceType } from '@/types/ApiResources'
import type { EnrollmentType } from '@/types/ApiWorkspace'
const props = defineProps<{ ownerId: string; workspaceId: string }>(),
  emit = defineEmits<{ busy: [boolean] }>()
const api = useScopedApiResource(
  () => props.ownerId,
  () => props.workspaceId,
  async (owner, id, signal) => {
    const [resources, roster] = await Promise.all([
      apiRequest<{ items: ResourceType[] }>(`/resources?kind=tags&workspaceId=${id}`, {
        ownerId: owner,
        signal
      }),
      apiRequest<{ items: EnrollmentType[] }>(`/workspaces/${id}/students`, {
        ownerId: owner,
        signal
      })
    ])
    return { resource: resources.items[0] || null, students: roster.items }
  }
)
const { state, loading, saving, errorMessage } = api,
  lines = ref(''),
  assignments = ref<Record<string, string[]>>({})
function content() {
  const categories: string[] = [],
    tags: Record<string, string[]> = {}
  for (const line of lines.value.split('\n').filter((value) => value.trim())) {
    const [category, values = ''] = line.split(':')
    if (category?.trim()) {
      categories.push(category.trim())
      tags[category.trim()] = values
        .split(/[,，]/)
        .map((value) => value.trim())
        .filter(Boolean)
    }
  }
  return { categories, tags, assignments: assignments.value }
}
const allTags = computed(() => [...new Set(Object.values(content().tags).flat())])
const baseline = ref(''),
  hasDraft = computed(() => JSON.stringify(content()) !== baseline.value)
function reset(): void {
  const data = state.value?.resource?.content as
    | {
        categories?: string[]
        tags?: Record<string, string[]>
        assignments?: Record<string, string[]>
      }
    | undefined
  lines.value = (data?.categories || [])
    .map((category) => `${category}:${(data?.tags?.[category] || []).join(',')}`)
    .join('\n')
  assignments.value = structuredClone(data?.assignments || {})
  baseline.value = JSON.stringify(content())
}
async function save(): Promise<void> {
  try {
    await api.write(`/resources/tags/${props.workspaceId}`, 'PUT', {
      workspaceId: props.workspaceId,
      name: '评语标签',
      content: content(),
      version: state.value?.resource?.version || 0
    })
    reset()
    ElMessage.success('标签已保存')
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '保存失败')
  }
}
watch(() => state.value, reset)
watch(
  () => loading.value || saving.value,
  (value) => emit('busy', value)
)
watch(
  () => [props.ownerId, props.workspaceId],
  () => {
    api.clear()
    reset()
    void api.load().catch((error) => console.error('读取标签失败:', error))
  },
  { immediate: true }
)
defineExpose({ hasDraft, reset })
</script>
<template>
  <section v-loading="loading">
    <el-alert v-if="errorMessage" :title="errorMessage" type="error" />
    <p>每行一个分类，格式：学习态度:认真,主动,细心。标签跟随当前班级学期。</p>
    <el-input v-model="lines" :disabled="saving" type="textarea" :rows="5" /><el-button
      :disabled="saving"
      @click="save"
      >保存分类、标签与学生选择</el-button
    ><el-button :disabled="saving" @click="reset">取消修改</el-button
    ><el-table :data="state?.students || []"
      ><el-table-column prop="name" label="学生" /><el-table-column label="表现标签"
        ><template #default="{ row }"
          ><el-select
            v-model="assignments[row.studentId]"
            multiple
            :disabled="saving || row.disabled || row.departed"
            ><el-option
              v-for="tag in allTags"
              :key="tag"
              :label="tag"
              :value="tag" /></el-select></template></el-table-column
    ></el-table>
  </section>
</template>
