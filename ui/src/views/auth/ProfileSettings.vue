<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import { ElMessage, ElMessageBox } from 'element-plus'

import ManagementCard from '@/components/ManagementCard.vue'

import { apiRequest, isManagingAccount, setAccessToken } from '@/api/client'
import type { AccountProfileType } from '@/types/Auth'

const props = defineProps<{ user: AccountProfileType }>()
const emit = defineEmits<{ update: []; logout: [] }>()
const activeTab = ref(props.user.mustChangePassword ? 'password' : 'profile')
const nickname = ref(props.user.nickname)
const currentPassword = ref('')
const newPassword = ref('')
const confirmation = ref('')
const busy = ref(false)

function report(error: unknown): void {
  if (error === 'cancel' || error === 'close') return
  console.error('个人设置操作失败:', error)
  ElMessage.error(error instanceof Error ? error.message : '操作失败')
}

async function saveNickname(): Promise<void> {
  busy.value = true
  try {
    await apiRequest('/me/profile', { method: 'PATCH', body: { nickname: nickname.value } })
    ElMessage.success('昵称已保存')
    emit('update')
  } catch (error) {
    report(error)
  } finally {
    busy.value = false
  }
}

/** 改密成功后撤销全部登录，当前页面也须重新登录，不能继续使用旧令牌。 */
async function savePassword(): Promise<void> {
  if (newPassword.value !== confirmation.value) {
    ElMessage.error('两次新密码不一致')
    return
  }
  busy.value = true
  try {
    await apiRequest('/me/password', {
      method: 'POST',
      body: {
        currentPassword: currentPassword.value,
        newPassword: newPassword.value
      }
    })
    currentPassword.value = newPassword.value = confirmation.value = ''
    if (!isManagingAccount()) setAccessToken('')
    ElMessage.success('密码已更新，请重新登录')
    emit('logout')
  } catch (error) {
    report(error)
  } finally {
    busy.value = false
  }
}

async function toggleVip(): Promise<void> {
  busy.value = true
  try {
    const { value } = await ElMessageBox.prompt(
      '请输入当前管理员密码确认',
      props.user.superVip ? '关闭账号代管' : '开启账号代管',
      { inputType: 'password' }
    )
    await apiRequest('/admin/me/super-vip', {
      method: 'PATCH',
      body: { enabled: !props.user.superVip, password: value }
    })
    emit('update')
  } catch (error) {
    report(error)
  } finally {
    busy.value = false
  }
}

watch(
  () => props.user.nickname,
  (value) => {
    nickname.value = value
  }
)
const hasDraft = computed(
  () =>
    nickname.value !== props.user.nickname ||
    Boolean(currentPassword.value || newPassword.value || confirmation.value)
)
/** 个人资料与密码草稿同样参与页面及账号切换检查。 */
async function canLeave(): Promise<boolean> {
  if (busy.value) {
    ElMessage.warning('请等待保存完成')
    return false
  }
  if (!hasDraft.value) return true
  try {
    await ElMessageBox.confirm('当前有未保存的个人设置，确认放弃？', '未保存的修改', {
      type: 'warning'
    })
    nickname.value = props.user.nickname
    currentPassword.value = newPassword.value = confirmation.value = ''
    return true
  } catch {
    return false
  }
}
defineExpose({ canLeave })
</script>

<template>
  <section class="profile-settings" v-loading="busy">
    <el-alert
      v-if="user.mustChangePassword"
      title="首次登录请先修改初始密码"
      type="warning"
      :closable="false"
    />
    <el-tabs v-model="activeTab" class="management-tabs" :before-leave="() => !busy">
      <el-tab-pane v-if="!user.mustChangePassword" label="账号资料" name="profile">
        <ManagementCard
          v-if="!user.mustChangePassword"
          title="账号资料"
          description="手机号作为登录账号，昵称用于身份展示。"
        >
          <el-form label-position="top">
            <el-form-item label="手机号"
              ><el-input :model-value="user.phone" disabled
            /></el-form-item>
            <el-form-item label="昵称"><el-input v-model="nickname" maxlength="30" /></el-form-item>
            <el-button type="primary" :loading="busy" @click="saveNickname">保存昵称</el-button>
          </el-form>
        </ManagementCard>
      </el-tab-pane>
      <el-tab-pane label="密码安全" name="password">
        <ManagementCard title="密码安全" description="修改密码后所有设备将退出登录。">
          <el-form label-position="top">
            <el-form-item label="当前密码"
              ><el-input
                v-model="currentPassword"
                type="password"
                show-password
                autocomplete="current-password"
            /></el-form-item>
            <el-form-item label="新密码（不能是纯数字）"
              ><el-input
                v-model="newPassword"
                type="password"
                show-password
                autocomplete="new-password"
            /></el-form-item>
            <el-form-item label="确认新密码"
              ><el-input
                v-model="confirmation"
                type="password"
                show-password
                autocomplete="new-password"
            /></el-form-item>
            <el-button type="primary" :loading="busy" @click="savePassword"
              >修改密码并重新登录</el-button
            >
          </el-form>
        </ManagementCard>
      </el-tab-pane>
      <el-tab-pane
        label="账号代管"
        name="managed"
        v-if="user.role === 'ADMIN' && !user.mustChangePassword"
      >
        <ManagementCard
          title="账号代管"
          description="开启后可切换到老师的完整工作台，操作记录保留管理员身份。"
        >
          <el-button @click="toggleVip">{{
            user.superVip ? '关闭账号代管' : '开启账号代管'
          }}</el-button>
        </ManagementCard>
      </el-tab-pane>
    </el-tabs>
  </section>
</template>

<style scoped lang="scss">
.profile-settings {
  max-width: 100%;
  .el-alert {
    margin-bottom: 20px;
  }
  h3 {
    margin-top: 28px;
  }
  p {
    color: var(--text-secondary);
    font-size: 13px;
  }
}
</style>
