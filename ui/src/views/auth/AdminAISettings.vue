<script setup lang="ts">
import { onMounted, ref } from 'vue'

import { ElMessage } from 'element-plus'

import ManagementCard from '@/components/ManagementCard.vue'
import { apiRequest } from '@/api/client'
import { useAISettingsLeave } from '@/hooks/api/useAISettingsLeave'
import AICallMonitor from './ai/AICallMonitor.vue'
import AIProviderForm from './ai/AIProviderForm.vue'
import AIQuotaManager from './ai/AIQuotaManager.vue'
import type { AIConfigType } from '@/types/ApiAI'
const activeTab = ref('model'),
  monitorBusy = ref(false),
  busy = ref(false),
  errorMessage = ref(''),
  loadingConfig = ref(false)
const providerForm = ref<{ hasDraft: boolean; reset: () => void }>()
const quotaManager = ref<InstanceType<typeof AIQuotaManager>>()
const config = ref<AIConfigType | null>(null)
const leave = useAISettingsLeave(
  () => busy.value || monitorBusy.value || loadingConfig.value,
  () => Boolean(providerForm.value?.hasDraft),
  () => providerForm.value?.reset()
)
async function canLeave(): Promise<boolean> {
  return (await leave.canLeave()) && (await quotaManager.value?.canLeave()) !== false
}
defineExpose({ canLeave })
async function loadConfig(): Promise<void> {
  if (loadingConfig.value) return
  loadingConfig.value = true
  try {
    config.value = await apiRequest<AIConfigType>('/admin/ai/config')
    errorMessage.value = ''
  } catch (error) {
    console.error('读取平台 AI 配置失败:', error)
    errorMessage.value = error instanceof Error ? error.message : '读取失败'
  } finally {
    loadingConfig.value = false
  }
}
/** 刷新仅作用于已保存表单，避免覆盖用户当前正在填写的配置。 */
async function refreshConfig(): Promise<void> {
  if (busy.value || monitorBusy.value || loadingConfig.value) return
  if (providerForm.value?.hasDraft) {
    ElMessage.warning('请先保存当前修改，再刷新平台配置')
    return
  }
  await loadConfig()
}
onMounted(() => void loadConfig())
</script>

<template>
  <section>
    <el-alert v-if="errorMessage" :title="errorMessage" type="error" :closable="false" />
    <el-tabs v-model="activeTab" class="management-tabs" :before-leave="canLeave">
      <el-tab-pane label="模型配置" name="model">
        <ManagementCard title="统一模型配置" description="配置老师共用的模型服务与 API Key。">
          <template #actions>
            <el-button
              :loading="loadingConfig"
              :disabled="busy || monitorBusy || Boolean(providerForm?.hasDraft)"
              :title="providerForm?.hasDraft ? '请先保存当前修改，再刷新平台配置' : undefined"
              @click="refreshConfig"
              >刷新平台配置</el-button
            ></template
          >
          <AIProviderForm
            :disabled="monitorBusy || loadingConfig"
            ref="providerForm"
            v-if="config"
            :config="config"
            platform
            @saved="loadConfig"
            @busy="busy = $event"
          />
        </ManagementCard>
      </el-tab-pane>
      <el-tab-pane label="账号额度" name="quota">
        <AIQuotaManager
          ref="quotaManager"
          :config="config"
          :disabled="busy || monitorBusy || loadingConfig"
          @busy="busy = $event"
          @configure="activeTab = 'model'"
        />
      </el-tab-pane>
      <el-tab-pane label="调用记录" name="calls">
        <AICallMonitor
          :disabled="busy || loadingConfig"
          @busy="monitorBusy = $event"
          @settled="quotaManager?.load()"
        />
      </el-tab-pane>
    </el-tabs>
  </section>
</template>

<style scoped lang="scss">
.quota-toolbar {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  .el-input {
    max-width: 280px;
  }
  .el-select {
    width: 280px;
    max-width: 100%;
  }
}
.quota-summary {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  margin: 20px 0;
  div {
    padding: 16px;
    border-radius: 10px;
    background: var(--theme-menu-active-bg);
  }
  span {
    display: block;
    font-size: 13px;
    color: var(--text-secondary);
  }
  strong {
    display: block;
    font-size: 24px;
    margin-top: 8px;
    color: var(--theme-primary);
    overflow-wrap: anywhere;
  }
}
@media (max-width: 600px) {
  .quota-summary {
    grid-template-columns: 1fr;
  }
}
</style>
