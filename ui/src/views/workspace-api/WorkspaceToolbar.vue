<script setup lang="ts">
import type { AccountProfileType } from '@/types/Auth'
import type { WorkspaceRecordType } from '@/types/ApiWorkspace'
defineProps<{
  user: AccountProfileType
  ownerId: string
  selectedId: string
  catalog: WorkspaceRecordType[]
  hasWorkspace: boolean
  disabled: boolean
}>()
const emit = defineEmits<{
  period: [id: string]
  dialog: [mode: 'create' | 'edit' | 'promote']
  refresh: []
  remove: [wholeClass: boolean]
}>()
</script>
<template>
  <div class="workspace-panel__toolbar">
    <el-select
      :model-value="selectedId"
      :disabled="disabled"
      placeholder="选择班级 / 学期"
      @change="(id: string) => emit('period', id)"
      ><el-option
        v-for="item in catalog"
        :key="item.id"
        :value="item.id"
        :label="`${item.className} / ${item.termName}`"
    /></el-select>
    <el-button :disabled="disabled" @click="emit('dialog', 'create')">新建班级学期</el-button>
    <el-button :disabled="disabled || !hasWorkspace" @click="emit('dialog', 'edit')"
      >编辑</el-button
    >
    <el-button :disabled="disabled || !hasWorkspace" @click="emit('dialog', 'promote')"
      >进入新学期</el-button
    >
    <el-button :disabled="disabled" @click="emit('refresh')">刷新</el-button>
    <el-button type="danger" :disabled="disabled || !hasWorkspace" @click="emit('remove', false)"
      >删除本学期</el-button
    >
    <el-button type="danger" :disabled="disabled || !hasWorkspace" @click="emit('remove', true)"
      >删除该班全部学期</el-button
    >
  </div>
</template>
<style scoped lang="scss">
.workspace-panel__toolbar {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 20px;
  .el-select {
    width: 240px;
  }
}
</style>
