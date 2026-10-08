<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import ManagementCard from '@/components/ManagementCard.vue'

import { apiRequest } from '@/api/client'
import type { AICallRecordType } from '@/types/ApiAI'
const props = defineProps<{ disabled?: boolean }>(),
  emit = defineEmits<{ busy: [boolean]; settled: [] }>()
const items = ref<AICallRecordType[]>([]),
  busy = ref(false)
/** 优先显示可识别的账号资料，历史账号缺失时保留 ID 便于核对。 */
function accountLabel(nickname: string | null, phone: string | null, id: string): string {
  return [nickname, phone].filter(Boolean).join(' · ') || id
}
/** 调用时间使用浏览器本地时区，包含日期和秒。 */
function callTime(timestamp: number): string {
  const date = new Date(timestamp)
  return Number.isFinite(date.getTime())
    ? date.toLocaleString('zh-CN', { hour12: false })
    : '时间未知'
}
/** 显示可读调用状态，未知状态保留服务端原值。 */
function callStatus(status: string): string {
  const labels: Record<string, string> = {
    UNCERTAIN: '待核对',
    SETTLED: '已结算',
    RESERVED: '已预占',
    FAILED: '失败',
    CANCELLED: '已取消',
    RUNNING: '调用中',
    SUCCEEDED: '成功',
    DONE: '已完成'
  }
  return labels[status] || status
}
const keys = new Map<string, string>()
let alive = true
async function load(): Promise<void> {
  try {
    const result = await apiRequest<{ items: typeof items.value }>('/admin/ai/calls')
    if (alive) items.value = result.items
  } catch (error) {
    if (alive) ElMessage.error(error instanceof Error ? error.message : '读取失败')
  }
}
/** 供应商账单核对后填写用量和原因；原内容重试使用相同幂等键。 */
async function reconcile(id: string): Promise<void> {
  if (busy.value || props.disabled) return
  busy.value = true
  try {
    const result = await ElMessageBox.prompt(
      '请核对供应商账单，填写实际输入＋输出 Token 总数；确认无消耗填写 0。',
      '核对调用',
      {
        inputValidator: (value) => /^\d+$/.test(value) && Number(value) <= 1000000000,
        inputErrorMessage: '请输入有效 Token 数量'
      }
    )
    const explanation = await ElMessageBox.prompt('请填写核对依据或账单编号。', '核对原因', {
      inputValue: '按供应商账单确认',
      inputValidator: (value) => Boolean(value.trim()) && value.length <= 200,
      inputErrorMessage: '请输入 1–200 字核对原因'
    })
    const body = { actual: Number(result.value), reason: explanation.value.trim() },
      fingerprint = JSON.stringify([id, body])
    if (!keys.has(fingerprint)) keys.set(fingerprint, crypto.randomUUID())
    await apiRequest(`/admin/ai/calls/${id}/reconcile`, {
      method: 'POST',
      body,
      idempotencyKey: keys.get(fingerprint)
    })
    if (alive) {
      emit('settled')
      await load()
    }
  } catch (error) {
    if (alive && error instanceof Error) ElMessage.error(error.message)
  } finally {
    busy.value = false
  }
}
watch(busy, (value) => emit('busy', value), { immediate: true })
onMounted(load)
onBeforeUnmount(() => {
  alive = false
  emit('busy', false)
})
</script>
<template>
  <ManagementCard
    title="AI 调用记录与用量核对"
    description="显示最近 100 次调用，未知用量需核对供应商账单后结算。"
  >
    <template #actions>
      <el-button :disabled="busy || disabled" @click="load">刷新记录</el-button></template
    >
    <el-table :data="items" empty-text="暂无 AI 调用记录"
      ><el-table-column
        prop="id"
        label="调用 ID"
        min-width="180"
        show-overflow-tooltip
      /><el-table-column label="实际调用账号" min-width="220" show-overflow-tooltip
        ><template #default="{ row }">{{
          accountLabel(row.actorNickname, row.actorPhone, row.actorId)
        }}</template></el-table-column
      ><el-table-column label="数据归属账号" min-width="220" show-overflow-tooltip
        ><template #default="{ row }">{{
          accountLabel(row.ownerNickname, row.ownerPhone, row.ownerId)
        }}</template></el-table-column
      ><el-table-column label="调用时间" min-width="190"
        ><template #default="{ row }">{{ callTime(row.createdAt) }}</template></el-table-column
      ><el-table-column label="状态" min-width="120"
        ><template #default="{ row }"
          ><el-tag :type="row.status === 'UNCERTAIN' ? 'warning' : 'info'">{{
            callStatus(row.status)
          }}</el-tag></template
        ></el-table-column
      ><el-table-column label="输入 / 输出"
        ><template #default="{ row }"
          >{{ row.inputTokens ?? '未确认' }} / {{ row.outputTokens ?? '未确认' }}</template
        ></el-table-column
      ><el-table-column label="处理"
        ><template #default="{ row }"
          ><el-button
            v-if="row.status === 'UNCERTAIN'"
            :disabled="busy || disabled"
            @click="reconcile(row.id)"
            >核对结算</el-button
          ></template
        ></el-table-column
      ></el-table
    >
  </ManagementCard>
</template>
