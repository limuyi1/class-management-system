<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import ManagementCard from '@/components/ManagementCard.vue'
import { apiRequest, ApiRequestError } from '@/api/client'
import type { AIConfigType, AIQuotaType, AIQuotaAccountType, AIQuotaListType } from '@/types/ApiAI'
import type { AccountProfileType } from '@/types/Auth'

const props = defineProps<{ config: AIConfigType | null; disabled: boolean }>()
const emit = defineEmits<{ busy: [boolean]; configure: [] }>()
type QuotaRowType = AIQuotaAccountType
const items = ref<QuotaRowType[]>([]),
  total = ref(0),
  page = ref(1)
const search = ref(''),
  status = ref(''),
  loading = ref(false),
  busy = ref(false)
const dialog = ref(false),
  accounts = ref<AccountProfileType[]>([]),
  ownerId = ref('')
const quota = ref<AIQuotaType | null>(null),
  amount = ref(10000),
  reason = ref('')
const subtract = ref(false),
  accountSearch = ref('')
let epoch = 0,
  quotaEpoch = 0
let pending: { fingerprint: string; key: string } | undefined
const ready = computed(() =>
  Boolean(
    props.config?.configured && props.config.enabled && props.config.model && props.config.baseUrl
  )
)
const blocked = computed(() => busy.value || props.disabled)
/** 分页只接收最新查询结果，避免快速筛选覆盖新列表。 */
async function load(): Promise<void> {
  const current = ++epoch
  loading.value = true
  try {
    const result = await apiRequest<AIQuotaListType>(
      `/admin/ai/quotas?page=${page.value}&search=${encodeURIComponent(search.value)}&status=${status.value}`
    )
    if (current === epoch) {
      items.value = result.items
      total.value = result.total
    }
  } catch (error) {
    report(error)
  } finally {
    if (current === epoch) loading.value = false
  }
}
function report(error: unknown): void {
  console.error('账号额度操作失败:', error)
  ElMessage.error(error instanceof Error ? error.message : '额度操作失败')
}
function filter(): void {
  page.value = 1
  void load()
}
/** 账号候选只包含可追加的老师；搜索由服务器分页限制。 */
async function findAccounts(value = ''): Promise<void> {
  accountSearch.value = value
  try {
    const result = await apiRequest<{ items: AccountProfileType[] }>(
      `/admin/users?search=${encodeURIComponent(value)}&page=1`
    )
    if (value === accountSearch.value)
      accounts.value = result.items.filter((a) => a.role === 'USER' && a.status === 'ACTIVE')
  } catch (error) {
    report(error)
  }
}
async function selectAccount(): Promise<void> {
  const id = ownerId.value,
    current = ++quotaEpoch
  quota.value = null
  if (!id) return
  try {
    const result = await apiRequest<AIQuotaType>(`/admin/users/${id}/ai-quota`)
    if (id === ownerId.value && current === quotaEpoch) quota.value = result
  } catch (error) {
    report(error)
  }
}
async function open(row?: QuotaRowType, deduct = false): Promise<void> {
  if (blocked.value || (!deduct && !ready.value)) return
  subtract.value = deduct
  amount.value = deduct ? 1 : 10000
  reason.value = ''
  pending = undefined
  ownerId.value = row?.id || ''
  quota.value = row || null
  accounts.value = []
  if (row)
    accounts.value = [
      {
        ...row,
        status: row.status as AccountProfileType['status'],
        role: 'USER',
        superVip: false,
        mustChangePassword: false
      }
    ]
  dialog.value = true
  if (!row) {
    try {
      await findAccounts()
    } catch (error) {
      report(error)
    }
  }
}
/** 调整与请求键绑定；冲突更新余额但保留输入供管理员重新核对。 */
async function save(): Promise<void> {
  if (blocked.value || !quota.value || !ownerId.value) return
  if (
    !Number.isSafeInteger(amount.value) ||
    amount.value <= 0 ||
    amount.value > 1000000000 ||
    !reason.value.trim()
  ) {
    ElMessage.warning('请输入正整数 Token 数量和调整原因')
    return
  }
  const body = {
    delta: subtract.value ? -amount.value : amount.value,
    version: quota.value.version,
    reason: reason.value.trim()
  }
  const fingerprint = JSON.stringify([ownerId.value, body])
  if (pending?.fingerprint !== fingerprint) pending = { fingerprint, key: crypto.randomUUID() }
  busy.value = true
  emit('busy', true)
  try {
    await apiRequest(`/admin/users/${ownerId.value}/ai-quota`, {
      method: 'POST',
      body,
      idempotencyKey: pending.key
    })
    pending = undefined
    dialog.value = false
    ElMessage.success('额度已保存')
    await load()
  } catch (error) {
    report(error)
    if (error instanceof ApiRequestError && error.code === 'VERSION_CONFLICT') await selectAccount()
  } finally {
    busy.value = false
    emit('busy', false)
  }
}
async function canLeave(): Promise<boolean> {
  if (busy.value) return false
  if (!dialog.value) return true
  try {
    await ElMessageBox.confirm('当前额度调整尚未提交，确认放弃？', '未保存的修改')
    dialog.value = false
    return true
  } catch {
    return false
  }
}
defineExpose({ canLeave, load })
onMounted(() => void load())
</script>
<template>
  <ManagementCard title="账号 Token 额度" description="输入与输出均计入累计消耗，额度不按月重置。">
    <template #actions
      ><el-button type="primary" :disabled="blocked || !ready" @click="open()"
        >添加账号额度</el-button
      ></template
    >
    <el-alert v-if="!ready" type="warning" :closable="false" title="请先配置并启用平台模型">
      <el-button text @click="emit('configure')">前往模型配置</el-button>
    </el-alert>
    <div class="quota-toolbar">
      <el-input
        v-model="search"
        clearable
        placeholder="搜索手机号或昵称"
        :disabled="blocked"
        @keyup.enter="filter"
      />
      <el-select
        v-model="status"
        clearable
        placeholder="账号状态"
        :disabled="blocked"
        @change="filter"
        ><el-option label="正常" value="ACTIVE" /><el-option label="禁用" value="DISABLED"
      /></el-select>
      <el-button :disabled="blocked" @click="filter">搜索</el-button
      ><el-button :disabled="blocked" @click="load">刷新</el-button>
    </div>
    <el-table
      :data="items"
      v-loading="loading"
      row-key="id"
      empty-text="暂无账号额度，请点击添加账号额度"
    >
      <el-table-column prop="phone" label="手机号" min-width="140" /><el-table-column
        prop="nickname"
        label="昵称"
        min-width="120"
      />
      <el-table-column label="账号状态"
        ><template #default="{ row }">{{
          row.status === 'ACTIVE' ? '正常' : '禁用'
        }}</template></el-table-column
      >
      <el-table-column
        v-for="field in [
          { key: 'available', label: '可用 Token' },
          { key: 'reserved', label: '预占 Token' },
          { key: 'used', label: '累计消耗' }
        ]"
        :key="field.key"
        :label="field.label"
        min-width="120"
        ><template #default="{ row }">{{
          row[field.key].toLocaleString()
        }}</template></el-table-column
      >
      <el-table-column label="操作" width="160"
        ><template #default="{ row }"
          ><el-button
            text
            :disabled="blocked || !ready || row.status !== 'ACTIVE'"
            @click="open(row)"
            >追加</el-button
          ><el-button text :disabled="blocked || row.available <= 0" @click="open(row, true)"
            >扣减</el-button
          ></template
        ></el-table-column
      >
    </el-table>
    <el-pagination
      v-model:current-page="page"
      :total="total"
      :page-size="50"
      layout="total, prev, pager, next"
      :disabled="blocked"
      @current-change="load"
    />
    <el-dialog
      v-model="dialog"
      :title="subtract ? '扣减账号额度' : '添加账号额度'"
      width="min(520px,92vw)"
      :close-on-click-modal="false"
      :close-on-press-escape="!busy"
      :show-close="!busy"
    >
      <el-form label-position="top"
        ><el-form-item label="老师账号"
          ><el-select
            v-model="ownerId"
            filterable
            remote
            :remote-method="findAccounts"
            :disabled="blocked || subtract"
            placeholder="搜索手机号或昵称"
            @change="selectAccount"
            ><el-option
              v-for="account in accounts"
              :key="account.id"
              :value="account.id"
              :label="`${account.nickname}（${account.phone}）`" /></el-select
        ></el-form-item>
        <p v-if="quota">
          当前可用 {{ quota.available.toLocaleString() }} · 预占
          {{ quota.reserved.toLocaleString() }} · 累计消耗 {{ quota.used.toLocaleString() }}
        </p>
        <el-form-item :label="subtract ? '扣减数量（Token）' : '追加数量（Token）'"
          ><el-input-number
            v-model="amount"
            :min="1"
            :max="1000000000"
            :precision="0"
            :disabled="blocked"
        /></el-form-item>
        <el-form-item label="调整原因"
          ><el-input v-model="reason" maxlength="200" :disabled="blocked"
        /></el-form-item>
      </el-form>
      <template #footer
        ><el-button :disabled="busy" @click="dialog = false">取消</el-button
        ><el-button
          type="primary"
          :loading="busy"
          :disabled="!quota || props.disabled || (!subtract && !ready)"
          @click="save"
          >确认{{ subtract ? '扣减' : '添加' }}</el-button
        ></template
      >
    </el-dialog>
  </ManagementCard>
</template>
<style scoped lang="scss">
.quota-toolbar {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  margin: 16px 0;
  .el-input {
    max-width: 280px;
  }
  .el-select {
    width: 140px;
  }
}
.el-pagination {
  margin-top: 16px;
}
</style>
