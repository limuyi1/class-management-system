<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { apiRequest } from '@/api/client'
import { useScopedApiResource } from '@/hooks/api/useScopedApiResource'
import type { ResourceType } from '@/types/ApiResources'
const props = defineProps<{ ownerId: string }>(),
  emit = defineEmits<{ busy: [boolean] }>()
const api = useScopedApiResource(
  () => props.ownerId,
  () => '',
  async (owner, _id, signal) =>
    apiRequest<{ items: ResourceType[] }>('/resources?kind=settings', { ownerId: owner, signal })
)
const { state, loading, saving } = api,
  fontFamily = ref('system-ui'),
  fontSize = ref(14),
  paperType = ref('A4'),
  prompts = ref(''),
  layout = ref('{}'),
  templates = ref('[]')
function content() {
  return {
    ...state.value?.items[0]?.content,
    fontFamily: fontFamily.value,
    fontSize: fontSize.value,
    paperType: paperType.value,
    prompts: prompts.value,
    layout: JSON.parse(layout.value) as unknown,
    templates: JSON.parse(templates.value) as unknown
  }
}
const baseline = ref(''),
  hasDraft = computed(
    () =>
      JSON.stringify([
        fontFamily.value,
        fontSize.value,
        paperType.value,
        prompts.value,
        layout.value,
        templates.value
      ]) !== baseline.value
  )
function reset(): void {
  const value = state.value?.items[0]?.content
  fontFamily.value = String(value?.fontFamily || 'system-ui')
  fontSize.value = Number(value?.fontSize || 14)
  paperType.value = String(value?.paperType || 'A4')
  prompts.value = String(value?.prompts || '')
  layout.value = JSON.stringify(value?.layout || {}, null, 2)
  templates.value = JSON.stringify(value?.templates || [], null, 2)
  baseline.value = JSON.stringify([
    fontFamily.value,
    fontSize.value,
    paperType.value,
    prompts.value,
    layout.value,
    templates.value
  ])
}
async function save(): Promise<void> {
  try {
    await api.write(`/resources/settings/${state.value?.items[0]?.id || props.ownerId}`, 'PUT', {
      workspaceId: null,
      name: '账号业务设置',
      content: content(),
      version: state.value?.items[0]?.version || 0
    })
    reset()
    window.dispatchEvent(new Event('account-appearance-updated'))
    ElMessage.success('账号设置已保存')
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
  () => props.ownerId,
  () => {
    api.clear()
    reset()
    void api.load().catch((error) => console.error('读取账号设置失败:', error))
  },
  { immediate: true }
)
defineExpose({ hasDraft, reset })
</script>
<template>
  <section v-loading="loading">
    <el-form :disabled="saving" label-width="120px"
      ><el-form-item label="界面字体"
        ><el-input v-model="fontFamily" maxlength="100" /></el-form-item
      ><el-form-item label="字号"
        ><el-input-number v-model="fontSize" :min="8" :max="72" /></el-form-item
      ><el-form-item label="默认纸张"
        ><el-select v-model="paperType"
          ><el-option
            v-for="type in ['A4', 'A3', 'B3', 'B4']"
            :key="type"
            :label="type"
            :value="type" /></el-select></el-form-item
      ><el-form-item label="AI 默认要求"
        ><el-input v-model="prompts" type="textarea" :rows="4" maxlength="8000" /></el-form-item
      ><el-form-item label="版式参数 JSON"
        ><el-input v-model="layout" type="textarea" :rows="5" /></el-form-item
      ><el-button @click="save">保存账号设置</el-button
      ><el-button @click="reset">取消修改</el-button></el-form
    >
  </section>
</template>
