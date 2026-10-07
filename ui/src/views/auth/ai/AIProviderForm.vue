<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { apiRequest } from '@/api/client'
import type { AIConfigType, AIConfigInputType } from '@/types/ApiAI'

const props = defineProps<{ config: AIConfigType; platform?: boolean; disabled?: boolean }>()
const emit = defineEmits<{ saved: []; busy: [value: boolean] }>()
const draft = reactive({
  provider: 'OPENAI' as AIConfigType['provider'],
  baseUrl: '',
  model: '',
  enabled: false
})
const apiKey = ref(''),
  clearKey = ref(false),
  saving = ref(false)
const hasDraft = computed(
  () =>
    Boolean(apiKey.value || clearKey.value) ||
    draft.provider !== props.config.provider ||
    draft.baseUrl !== props.config.baseUrl ||
    draft.model !== props.config.model ||
    draft.enabled !== props.config.enabled
)
defineExpose({ hasDraft, reset })
let retry: { fingerprint: string; key: string } | undefined
/** 放弃修改时清除内存中的新 Key 和重试数据。 */
function reset(): void {
  Object.assign(draft, props.config)
  apiKey.value = ''
  clearKey.value = false
  retry = undefined
}
watch(() => props.config, reset, { immediate: true })
/** 表单只提交新 Key；已保存 Key 永不回填到输入框或浏览器存储。 */
async function save(): Promise<void> {
  if (saving.value || props.disabled) return
  const body: AIConfigInputType = {
    provider: draft.provider,
    baseUrl: draft.baseUrl,
    model: draft.model,
    enabled: draft.enabled,
    version: props.config.version,
    ...(clearKey.value ? { apiKey: null } : apiKey.value ? { apiKey: apiKey.value } : {})
  }
  const fingerprint = JSON.stringify(body)
  if (retry?.fingerprint !== fingerprint) retry = { fingerprint, key: crypto.randomUUID() }
  saving.value = true
  emit('busy', true)
  try {
    await apiRequest(props.platform ? '/admin/ai/config' : '/me/ai/config', {
      method: 'PUT',
      body,
      idempotencyKey: retry.key
    })
    apiKey.value = ''
    retry = undefined
    ElMessage.success('AI 配置已保存')
    emit('saved')
  } catch (error) {
    console.error('保存 AI 配置失败:', error)
    ElMessage.error(error instanceof Error ? error.message : '保存失败')
  } finally {
    saving.value = false
    emit('busy', false)
  }
}
</script>
<template>
  <el-form label-position="top" class="ai-provider-form" :disabled="saving || disabled">
    <el-form-item label="接口类型"
      ><el-select v-model="draft.provider"
        ><el-option label="OpenAI 兼容接口" value="OPENAI" /><el-option
          label="Gemini"
          value="GEMINI" /></el-select
    ></el-form-item>
    <el-form-item label="服务地址"
      ><el-input v-model="draft.baseUrl" placeholder="HTTPS API 基础地址"
    /></el-form-item>
    <el-form-item label="模型名称"><el-input v-model="draft.model" /></el-form-item>
    <el-form-item label="API Key"
      ><el-input
        v-model="apiKey"
        type="password"
        show-password
        autocomplete="new-password"
        :placeholder="config.configured ? '已配置；留空保留原 Key' : '请输入 Key'"
    /></el-form-item>
    <el-form-item label="清除旧 Key"
      ><el-checkbox v-model="clearKey">清除已保存密钥（须同时关闭启用）</el-checkbox></el-form-item
    >
    <el-form-item label="启用"><el-switch v-model="draft.enabled" /></el-form-item>
    <el-form-item
      ><el-button type="primary" :loading="saving" @click="save">保存配置</el-button></el-form-item
    >
    <p v-if="!platform">个人 Key 仅支持管理员允许的服务地址；个人调用不扣平台额度。</p>
  </el-form>
</template>

<style scoped lang="scss">
.ai-provider-form {
  max-width: 820px;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  column-gap: 24px;
  :deep(.el-form-item) {
    min-width: 0;
  }
  :deep(.el-select) {
    width: 100%;
    min-width: 0;
  }
  > p {
    grid-column: 1 / -1;
  }
  @media (max-width: 760px) {
    grid-template-columns: 1fr;
  }
  p {
    font-size: 13px;
    color: var(--text-secondary);
    line-height: 1.7;
  }
}
</style>
