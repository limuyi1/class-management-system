<script setup lang="ts">
import { onMounted, ref } from 'vue'

import { ElMessage, ElMessageBox } from 'element-plus'

import ManagementCard from '@/components/ManagementCard.vue'

import { apiRequest, isManagingAccount, setAccessToken } from '@/api/client'

interface DeviceSessionType {
  id: string
  client: string
  createdAt: number
  expiresAt: number
  current: boolean
}
const emit = defineEmits<{ logout: [] }>()
const devices = ref<DeviceSessionType[]>([])
const busy = ref(false)

function report(error: unknown): void {
  if (error === 'cancel' || error === 'close') return
  console.error('设备登录操作失败:', error)
  ElMessage.error(error instanceof Error ? error.message : '操作失败')
}

/** 列表只含本人设备摘要，不包含访问或刷新令牌。 */
async function load(): Promise<void> {
  busy.value = true
  try {
    devices.value = await apiRequest<DeviceSessionType[]>('/me/devices')
  } catch (error) {
    report(error)
  } finally {
    busy.value = false
  }
}

/** 撤销当前设备后立即返回登录页，其他设备撤销则刷新列表。 */
async function revoke(device: DeviceSessionType): Promise<void> {
  try {
    await ElMessageBox.confirm(device.current ? '结束当前登录？' : '结束此设备登录？', '设备下线', {
      type: 'warning'
    })
    busy.value = true
    await apiRequest(`/me/devices/${device.id}`, { method: 'DELETE' })
    if (device.current) {
      if (!isManagingAccount()) setAccessToken('')
      emit('logout')
    } else await load()
  } catch (error) {
    report(error)
  } finally {
    busy.value = false
  }
}

async function revokeAll(): Promise<void> {
  try {
    await ElMessageBox.confirm('所有设备将立即下线，包括当前设备。', '退出所有设备', {
      type: 'warning'
    })
    busy.value = true
    await apiRequest('/me/devices/revoke-all', { method: 'POST' })
    if (!isManagingAccount()) setAccessToken('')
    emit('logout')
  } catch (error) {
    report(error)
  } finally {
    busy.value = false
  }
}
defineExpose({ canLeave: () => !busy.value })
onMounted(load)
</script>

<template>
  <ManagementCard
    title="设备登录记录"
    description="查看本人登录设备，可结束单个设备或所有设备的登录。"
    v-loading="busy"
  >
    <template #actions><el-button :disabled="busy" @click="load">刷新记录</el-button></template>
    <el-table :data="devices" row-key="id" empty-text="暂无登录设备">
      <el-table-column label="客户端"
        ><template #default="{ row }"
          >{{ row.client }}
          <el-tag v-if="row.current" size="small" type="success">当前设备</el-tag></template
        ></el-table-column
      >
      <el-table-column label="登录时间"
        ><template #default="{ row }">{{
          new Date(row.createdAt).toLocaleString()
        }}</template></el-table-column
      >
      <el-table-column label="到期时间"
        ><template #default="{ row }">{{
          new Date(row.expiresAt).toLocaleString()
        }}</template></el-table-column
      >
      <el-table-column label="操作"
        ><template #default="{ row }"
          ><el-button link type="danger" @click="revoke(row)">下线</el-button></template
        ></el-table-column
      >
    </el-table>
    <el-button class="device-sessions__revoke" type="danger" plain @click="revokeAll"
      >退出所有设备</el-button
    >
  </ManagementCard>
</template>

<style scoped lang="scss">
.device-sessions__revoke {
  margin-top: 20px;
}
</style>
