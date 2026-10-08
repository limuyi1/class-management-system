<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { apiRequest } from '@/api/client'
import type { AIConfigType, AIConfigInputType, AIModelQueryType } from '@/types/ApiAI'

const props = defineProps<{ config: AIConfigType; platform?: boolean; disabled?: boolean }>()
const emit = defineEmits<{ saved: []; busy: [value: boolean] }>()
const draft = reactive({
  provider: 'OPENAI' as AIConfigType['provider'],
  baseUrl: '',
  model: '',
  enabled: false
})
const apiKey = ref(''),
  saving = ref(false),
  refreshingModels = ref(false)
const models = ref<string[]>([])
const busy = computed(() => saving.value || refreshingModels.value)
watch(busy, (value) => emit('busy', value), { flush: 'sync' })
watch(
  () => [draft.provider, draft.baseUrl, apiKey.value],
  () => {
    models.value = []
  }
)
const hasDraft = computed(
  () =>
    apiKey.value !== (props.config.apiKey ?? '') ||
    draft.provider !== props.config.provider ||
    draft.baseUrl !== props.config.baseUrl ||
    draft.model !== props.config.model ||
    draft.enabled !== props.config.enabled
)
defineExpose({ hasDraft, reset })
let retry: { fingerprint: string; key: string } | undefined
/** 放弃修改时恢复配置和密码框的原值，清除重试数据。 */
function reset(): void {
  Object.assign(draft, props.config)
  apiKey.value = props.config.apiKey ?? ''
  retry = undefined
}
watch(() => props.config, reset, { immediate: true })
/** 按密码框当前值保存密钥；清空输入同时停用配置。 */
async function save(): Promise<void> {
  if (busy.value || props.disabled) return
  if (props.config.keyUnavailable && !apiKey.value.trim()) {
    ElMessage.warning('原 API Key 无法读取，请重新填写后保存')
    return
  }
  const body: AIConfigInputType = {
    provider: draft.provider,
    baseUrl: draft.baseUrl,
    model: draft.model,
    enabled: draft.enabled && Boolean(apiKey.value.trim()),
    version: props.config.version,
    apiKey: apiKey.value.trim() || null
  }
  const fingerprint = JSON.stringify(body)
  if (retry?.fingerprint !== fingerprint) retry = { fingerprint, key: crypto.randomUUID() }
  saving.value = true
  try {
    await apiRequest(props.platform ? '/admin/ai/config' : '/me/ai/config', {
      method: 'PUT',
      body,
      idempotencyKey: retry.key
    })
    draft.enabled = body.enabled
    retry = undefined
    ElMessage.success('AI 配置已保存')
    emit('saved')
  } catch (error) {
    console.error('保存 AI 配置失败:', error)
    ElMessage.error(error instanceof Error ? error.message : '保存失败')
  } finally {
    saving.value = false
  }
}
/** 使用密码框当前密钥查询模型，保留手填模型名称。 */
async function refreshModels(): Promise<void> {
  if (busy.value || props.disabled) return
  if (!draft.baseUrl.trim()) {
    ElMessage.warning('请先填写服务地址')
    return
  }
  if (!apiKey.value.trim()) {
    ElMessage.warning('请先填写 API Key')
    return
  }
  const body: AIModelQueryType = {
    provider: draft.provider,
    baseUrl: draft.baseUrl.trim(),
    apiKey: apiKey.value.trim()
  }
  refreshingModels.value = true
  try {
    const result = await apiRequest<{ items: string[] }>(
      props.platform ? '/admin/ai/models' : '/me/ai/models',
      {
        method: 'POST',
        body
      }
    )
    models.value = result.items
    if (!models.value.length) ElMessage.warning('服务未返回可用模型，可手动填写模型名称')
  } catch (error) {
    console.error('刷新模型列表失败:', error)
    ElMessage.error(error instanceof Error ? error.message : '刷新失败，可手动填写模型名称')
  } finally {
    refreshingModels.value = false
  }
}
</script>
<template>
  <el-form label-position="top" class="ai-provider-form" :disabled="busy || disabled">
    <el-alert
      v-if="config.keyUnavailable"
      class="ai-provider-form__key-warning"
      title="原 API Key 无法读取，请重新填写并保存。若需恢复原配置，请由服务器维护人员恢复原主密钥。"
      type="warning"
      :closable="false"
    />
    <el-form-item label="接口类型"
      ><el-select v-model="draft.provider"
        ><el-option label="OpenAI 兼容接口" value="OPENAI" /><el-option
          label="Gemini"
          value="GEMINI" /></el-select
    ></el-form-item>
    <el-form-item label="服务地址"
      ><el-input v-model="draft.baseUrl" placeholder="HTTP 或 HTTPS API 基础地址"
    /></el-form-item>
    <el-form-item label="模型名称">
      <div class="ai-provider-form__models">
        <el-select
          v-model="draft.model"
          filterable
          allow-create
          default-first-option
          placeholder="选择或输入模型名称"
        >
          <el-option v-for="model in models" :key="model" :label="model" :value="model" />
        </el-select>
        <el-tooltip content="刷新模型" placement="top">
          <el-button
            circle
            :loading="refreshingModels"
            aria-label="刷新模型"
            @click="refreshModels"
          >
            <font-awesome-icon v-if="!refreshingModels" :icon="['solid', 'arrows-rotate']" />
          </el-button>
        </el-tooltip>
      </div>
    </el-form-item>
    <el-form-item label="API Key"
      ><el-input
        v-model="apiKey"
        type="password"
        show-password
        autocomplete="new-password"
        placeholder="请输入 API Key"
    /></el-form-item>
    <el-form-item class="ai-provider-form__actions">
      <div class="ai-provider-form__action-row">
        <label class="ai-provider-form__enabled">
          <span>启用</span>
          <el-switch v-model="draft.enabled" aria-label="启用 AI 服务" />
        </label>
        <el-button type="primary" :loading="saving" @click="save">保存配置</el-button>
      </div>
    </el-form-item>
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
  &__key-warning {
    grid-column: 1 / -1;
    margin-bottom: 16px;
  }
  &__actions {
    grid-column: 1 / -1;
    margin-top: 4px;
  }
  &__action-row {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 24px;
  }
  &__enabled {
    display: flex;
    align-items: center;
    gap: 10px;
    color: var(--el-text-color-primary);
  }
  &__models {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    .el-select {
      flex: 1;
    }
    .el-button {
      flex-shrink: 0;
    }
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
