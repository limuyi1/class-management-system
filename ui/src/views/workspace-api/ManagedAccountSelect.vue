<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'

import { apiRequest } from '@/api/client'
import type { ManagedAccountType } from '@/types/ApiWorkspace'

const props = defineProps<{ actorId: string; modelValue: string; disabled: boolean }>()
const emit = defineEmits<{ select: [value: string, label: string] }>()
const items = ref<ManagedAccountType[]>([])
const known = new Map<string, ManagedAccountType>()
const options = computed(() => {
  const result = items.value.filter((item) => item.id !== props.actorId)
  const selected = known.get(props.modelValue)
  if (selected && selected.id !== props.actorId && !result.some((item) => item.id === selected.id))
    result.unshift(selected)
  return result
})
const loading = ref(false)
const errorMessage = ref('')
let generation = 0

/** 搜索只请求账号摘要，身份接口不能带当前业务代管账号。 */
async function search(value: string): Promise<void> {
  const current = ++generation
  loading.value = true
  try {
    const result = await apiRequest<{ items: ManagedAccountType[] }>(
      `/admin/managed-accounts?search=${encodeURIComponent(value)}`,
      { actorOnly: true }
    )
    if (current !== generation) return
    items.value = result.items
    for (const item of result.items) known.set(item.id, item)
    errorMessage.value = ''
  } catch (error) {
    if (current !== generation) return
    errorMessage.value = error instanceof Error ? error.message : '账号查询失败'
  } finally {
    if (current === generation) loading.value = false
  }
}
function select(id: string): void {
  const item = items.value.find((account) => account.id === id)
  emit('select', id, item ? `${item.nickname}（尾号 ${item.phoneSuffix}）` : '我的账号')
}
function visibleChange(visible: boolean): void {
  if (visible) void search('')
}
onBeforeUnmount(() => {
  generation++
})
</script>

<template>
  <div class="managed-account-select">
    <el-select
      :model-value="modelValue"
      :disabled="disabled"
      filterable
      remote
      :remote-method="search"
      :loading="loading"
      placeholder="选择代管账号"
      @visible-change="visibleChange"
      @change="select"
    >
      <el-option label="我的账号" :value="props.actorId" />
      <el-option
        v-for="item in options"
        :key="item.id"
        :value="item.id"
        :disabled="item.status !== 'ACTIVE'"
        :label="`${item.nickname}（尾号 ${item.phoneSuffix}）${item.status === 'DISABLED' ? ' · 已禁用' : ''}`"
      />
    </el-select>
    <span v-if="errorMessage" role="alert">{{ errorMessage }}</span>
  </div>
</template>

<style scoped lang="scss">
.managed-account-select {
  .el-select {
    width: 240px;
  }
  span {
    display: block;
    color: var(--el-color-danger);
    font-size: 12px;
  }
}
</style>
