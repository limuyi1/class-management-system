<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import ManagementCard from '@/components/ManagementCard.vue'

import { apiRequest } from '@/api/client'
import { useAISettingsLeave } from '@/hooks/api/useAISettingsLeave'
import AIProviderForm from './ai/AIProviderForm.vue'
import type { AISettingsType } from '@/types/ApiAI'

const emit = defineEmits<{ configured: [boolean] }>()
const activeTab = ref('mode')
const changingSection = ref(false)
const sections = [
  { label: '使用方式与额度', value: 'mode' },
  { label: '个人密钥配置', value: 'key' }
]
const providerForm = ref<{ hasDraft: boolean; reset: () => void }>()
const settings = ref<AISettingsType | null>(null),
  busy = ref(false),
  errorMessage = ref('')
watch(
  settings,
  (value) => {
    const config = value?.mode === 'PERSONAL' ? value.personal : value?.platform
    emit('configured', Boolean(config?.configured && config.enabled))
  },
  { deep: true }
)
const mode = ref<AISettingsType['mode']>('PLATFORM')
const personalConfig = computed(() =>
  settings.value
    ? {
        ...settings.value.personal,
        baseUrl: settings.value.personal.baseUrl || settings.value.platform.baseUrl,
        provider: settings.value.personal.version
          ? settings.value.personal.provider
          : settings.value.platform.provider
      }
    : null
)
const { canLeave } = useAISettingsLeave(
  () => busy.value,
  () =>
    Boolean(providerForm.value?.hasDraft) ||
    Boolean(settings.value && mode.value !== settings.value.mode),
  () => {
    providerForm.value?.reset()
    if (settings.value) mode.value = settings.value.mode
  }
)
defineExpose({ canLeave })
let pending: { mode: string; version: number; key: string } | undefined
/** 刷新读取平台状态与本人余额；默认无需填写个人密钥。 */
async function load(): Promise<void> {
  try {
    settings.value = await apiRequest<AISettingsType>('/me/ai')
    mode.value = settings.value.mode
    errorMessage.value = ''
  } catch (error) {
    settings.value = null
    console.error('读取 AI 设置失败:', error)
    errorMessage.value = error instanceof Error ? error.message : '读取失败'
  }
}
async function saveMode(): Promise<void> {
  if (!settings.value || busy.value) return
  const version = settings.value.version
  if (pending?.mode !== mode.value || pending.version !== version)
    pending = { mode: mode.value, version, key: crypto.randomUUID() }
  busy.value = true
  try {
    settings.value = await apiRequest<AISettingsType>('/me/ai/mode', {
      method: 'PUT',
      body: { mode: mode.value, version },
      idempotencyKey: pending.key
    })
    pending = undefined
    await load()
    ElMessage.success('AI 使用方式已保存')
  } catch (error) {
    console.error('切换 AI 使用方式失败:', error)
    ElMessage.error(error instanceof Error ? error.message : '保存失败')
  } finally {
    busy.value = false
  }
}
async function testConnection(): Promise<void> {
  if (busy.value) return
  busy.value = true
  try {
    const result = await apiRequest<{ status: string; result: { text: string } | null }>(
      '/ai/calls',
      { method: 'POST', body: { scene: 'test', prompt: '' }, idempotencyKey: crypto.randomUUID() }
    )
    ElMessage.success(result.result?.text || result.status)
    await load()
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '连接失败')
  } finally {
    busy.value = false
  }
}
/** 分段切换仍执行草稿保护，用户取消时保持原分段与表单。 */
async function selectSection(value: string | number | boolean): Promise<void> {
  if (typeof value !== 'string' || value === activeTab.value || busy.value || changingSection.value)
    return
  changingSection.value = true
  try {
    if (await canLeave()) activeTab.value = value
  } finally {
    changingSection.value = false
  }
}
onMounted(load)
</script>
<template>
  <section>
    <el-alert v-if="errorMessage" :title="errorMessage" type="error" :closable="false" />
    <el-segmented
      class="ai-settings__sections"
      :model-value="activeTab"
      :options="sections"
      :disabled="busy || changingSection"
      aria-label="AI 设置分区"
      @change="selectSection"
    />
    <div v-show="activeTab === 'mode'">
      <ManagementCard title="AI 使用方式" description="使用平台额度或个人密钥进行调用。">
        <template #actions
          ><el-button :disabled="busy" @click="load">刷新配置与额度</el-button></template
        >
        <template v-if="settings">
          <p>
            平台模型：{{ settings.platform.model || '未配置' }}；{{
              settings.platform.enabled && settings.platform.configured ? '已启用' : '暂不可用'
            }}
          </p>
          <div class="ai-settings__quota">
            <div>
              <span>可用额度</span><strong>{{ settings.quota.available.toLocaleString() }}</strong>
            </div>
            <div>
              <span>预占额度</span><strong>{{ settings.quota.reserved.toLocaleString() }}</strong>
            </div>
            <div>
              <span>累计消耗</span><strong>{{ settings.quota.used.toLocaleString() }}</strong>
            </div>
          </div>
          <div class="ai-settings__mode">
            <el-radio-group v-model="mode" :disabled="busy"
              ><el-radio value="PLATFORM">平台额度（无需个人 Key）</el-radio
              ><el-radio value="PERSONAL">个人 Key</el-radio></el-radio-group
            >
            <el-button :disabled="busy" @click="saveMode">保存使用方式</el-button>
            <el-button :disabled="busy" @click="testConnection"
              >测试所选模式连接（消耗少量 Token）</el-button
            >
          </div>
        </template>
      </ManagementCard>
    </div>
    <div v-show="activeTab === 'key'">
      <ManagementCard
        v-if="settings"
        title="个人 Key 配置（可选）"
        description="填写或修改个人 API Key，可通过小眼睛查看。"
      >
        <AIProviderForm
          ref="providerForm"
          :config="personalConfig!"
          @saved="load"
          @busy="busy = $event"
        />
      </ManagementCard>
    </div>
  </section>
</template>

<style scoped lang="scss">
.ai-settings__sections {
  margin-bottom: 16px;
  padding: 4px;
  --el-segmented-item-selected-color: var(--el-color-primary);
  --el-segmented-item-selected-bg-color: var(--el-bg-color);
  --el-border-radius-base: 8px;
}

.ai-settings__quota {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  margin: 20px 0;
  div {
    background: var(--theme-menu-active-bg);
    padding: 16px;
    border-radius: 10px;
  }
  span {
    display: block;
    color: var(--text-secondary);
    font-size: 13px;
  }
  strong {
    display: block;
    color: var(--theme-primary);
    font-size: 24px;
    margin-top: 8px;
    overflow-wrap: anywhere;
  }
}
.ai-settings__mode {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
  .el-button {
    margin: 0;
  }
}
@media (max-width: 600px) {
  .ai-settings__quota {
    grid-template-columns: 1fr;
  }
}
</style>
