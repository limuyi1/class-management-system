<script setup lang="ts">
import type { AccountProfileType } from '@/types/Auth'

/** 头像账号菜单展示当前有效用户，并将资料与退出操作交给主布局处理。 */
defineProps<{ user: AccountProfileType; canSwitch?: boolean }>()
const emit = defineEmits<{ profile: []; devices: []; logout: []; switchUser: [] }>()

/** 菜单操作沿用主布局的草稿保护与退出流程。 */
function handleCommand(command: string): void {
  if (command === 'devices') emit('devices')
  if (command === 'profile') emit('profile')
  if (command === 'switch') emit('switchUser')
  if (command === 'logout') emit('logout')
}
</script>

<template>
  <el-dropdown :trigger="['hover', 'click']" placement="bottom-end" @command="handleCommand">
    <button
      type="button"
      class="user-account-menu__trigger"
      :aria-label="`${user.nickname}的账号菜单`"
    >
      <el-avatar :size="34" class="user-account-menu__avatar">{{
        user.nickname.slice(0, 1) || '师'
      }}</el-avatar>
    </button>
    <template #dropdown>
      <div class="user-account-menu__panel">
        <div class="user-account-menu__summary">
          <strong>{{ user.nickname }}</strong>
          <el-tag size="small" effect="light">{{
            user.role === 'ADMIN' ? '管理员' : '老师'
          }}</el-tag>
          <span>{{ user.phone }}</span>
        </div>
        <el-dropdown-menu>
          <el-dropdown-item command="profile">用户信息</el-dropdown-item>
          <el-dropdown-item v-if="!user.mustChangePassword" command="devices"
            >登录设备</el-dropdown-item
          >
          <el-dropdown-item v-if="canSwitch" command="switch">切换用户</el-dropdown-item>
          <el-dropdown-item command="logout" divided>退出登录</el-dropdown-item>
        </el-dropdown-menu>
      </div>
    </template>
  </el-dropdown>
</template>

<style scoped lang="scss">
.user-account-menu {
  &__trigger {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 2px;
    border: 1px solid rgba(255, 255, 255, 0.6);
    border-radius: 50%;
    background: transparent;
    cursor: pointer;
    &:hover {
      background: rgba(255, 255, 255, 0.15);
    }
    &:focus-visible {
      outline: 2px solid #fff;
      outline-offset: 3px;
    }
  }
  &__avatar {
    background: var(--surface-card);
    color: var(--theme-primary);
    font-weight: 600;
    font-size: 16px;
  }
  &__panel {
    min-width: 200px;
    max-width: min(300px, 90vw);
  }
  &__summary {
    padding: 14px 16px;
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px;
    border-bottom: 1px solid var(--border-muted);
    strong {
      color: var(--text-primary);
      overflow-wrap: anywhere;
    }
    span:last-child {
      width: 100%;
      font-size: 12px;
      color: var(--text-secondary);
    }
  }
}
</style>
