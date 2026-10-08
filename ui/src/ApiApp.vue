<script setup lang="ts">
import { ref } from 'vue'

import { ElMessage } from 'element-plus'

import { hasPendingAccountWrites } from '@/api/client'
import { useApiAccountSession } from '@/hooks/api/useApiAccountSession'
import { useWorkbenchNavigation } from '@/hooks/api/useWorkbenchNavigation'
import ThemeMenu from '@/components/ThemeMenu.vue'
import UserAccountMenu from '@/components/UserAccountMenu.vue'
import PageHeader from '@/components/PageHeader.vue'
import logo from '@/assets/main/logo.png'
import LoginPage from '@/views/auth/LoginPage.vue'
import SetupPage from '@/views/auth/SetupPage.vue'
import ProfileSettings from '@/views/auth/ProfileSettings.vue'
import AccountManagement from '@/views/auth/AccountManagement.vue'
import ServerTeachingWorkbench from '@/views/main/ServerTeachingWorkbench.vue'
import WorkspaceSelector from '@/components/workspace/WorkspaceSelector.vue'
import WorkbenchSidebar from '@/components/WorkbenchSidebar.vue'
import LeftMenu from '@/views/main/components/LeftMenu.vue'
import ManagedAccountSelect from '@/views/workspace-api/ManagedAccountSelect.vue'
import DeviceSessions from '@/views/auth/DeviceSessions.vue'
import AdminAISettings from '@/views/auth/AdminAISettings.vue'

const session = useApiAccountSession({
  beforeLeave: () => beforeLeave(true),
  navigating: () => navigating.value,
  activatePage: (page) => resetPage(page)
})
const {
  appearance,
  actor,
  user,
  managed,
  contextKey,
  switching,
  switchDialog,
  candidate,
  loading,
  setup,
  startupError,
  setupPhone,
  setupFinished,
  onLogin,
  reloadUser,
  openSwitch,
  switchAccount,
  returnAdmin,
  identityRevoked,
  logout,
  initialize
} = session
const {
  teachingKeys,
  tab,
  visited,
  navigating,
  contentScroll,
  menuItems,
  activePage,
  selectPage,
  resetPage
} = useWorkbenchNavigation(
  user,
  () => beforeLeave(),
  () => switching.value
)

const menuCollapsed = ref(false)
const business = ref<InstanceType<typeof ServerTeachingWorkbench>>()
const adminAISettings = ref<InstanceType<typeof AdminAISettings>>()
const accountManagement = ref<InstanceType<typeof AccountManagement>>()
const profileSettings = ref<InstanceType<typeof ProfileSettings>>()
const deviceSessions = ref<InstanceType<typeof DeviceSessions>>()

/** 页面跳转检查当前草稿，账号切换检查所有已访问页面及全局提交。 */
async function beforeLeave(all = false): Promise<boolean> {
  if (hasPendingAccountWrites()) {
    ElMessage.warning('请等待提交、上传或 AI 调用完成')
    return false
  }
  const checks = [
    { key: teachingKeys, page: business.value },
    { key: ['admin-ai'], page: adminAISettings.value },
    { key: ['profile'], page: profileSettings.value },
    { key: ['devices'], page: deviceSessions.value },
    { key: ['accounts'], page: accountManagement.value }
  ]
  for (const check of checks) {
    if ((all || check.key.includes(tab.value)) && (await check.page?.canLeave?.()) === false)
      return false
  }
  return true
}
</script>

<template>
  <div v-if="loading" class="api-app__loading">正在加载...</div>
  <div v-else-if="startupError" class="api-app__loading">
    <div>
      <p>{{ startupError }}</p>
      <el-button @click="initialize">重新连接</el-button>
    </div>
  </div>
  <SetupPage
    v-else-if="setup?.required"
    :available="setup.available"
    @initialized="setupFinished"
  />
  <LoginPage v-else-if="!user" :initial-phone="setupPhone" @login="onLogin" />
  <main
    v-else
    :class="['api-app', { 'api-app--teacher': user.role === 'USER' }]"
    v-loading="switching"
    :style="appearance.style.value"
  >
    <header class="api-app__header">
      <div class="api-app__brand"><img :src="logo" alt="" /><strong>班务管理系统</strong></div>
      <div class="api-app__identity">
        <WorkspaceSelector v-if="user.role === 'USER' && !user.mustChangePassword" />
        <div v-if="managed" class="api-app__managed" role="status">
          <span class="api-app__managed-name" :title="`正在代管 ${user.nickname}`"
            >代管：{{ user.nickname }}</span
          >
          <el-button class="api-app__return" text :disabled="switching" @click="returnAdmin(false)"
            >返回管理员</el-button
          >
        </div>
        <ThemeMenu />
        <UserAccountMenu
          :user="user"
          :can-switch="!managed && Boolean(actor?.superVip) && !user.mustChangePassword"
          @profile="selectPage('profile')"
          @devices="selectPage('devices')"
          @switch-user="openSwitch"
          @logout="logout"
        />
      </div>
    </header>
    <div :key="contextKey" class="api-app__body">
      <aside class="api-app__aside">
        <LeftMenu v-if="user.role === 'USER' && !user.mustChangePassword" />
        <WorkbenchSidebar
          v-else
          v-model:collapsed="menuCollapsed"
          :items="menuItems"
          :active-key="tab"
          :navigating="navigating"
          @select="selectPage"
        />
      </aside>
      <el-scrollbar
        ref="contentScroll"
        class="api-app__content"
        view-class="api-app__content-view"
        aria-label="页面内容"
      >
        <PageHeader
          v-if="activePage && !teachingKeys.includes(tab)"
          :icon="['solid', activePage.icon]"
          :title="activePage.label"
          :subtitle="activePage.subtitle"
        />
        <div class="api-app__page">
          <ServerTeachingWorkbench
            v-if="user.role === 'USER' && !user.mustChangePassword"
            v-show="teachingKeys.includes(tab)"
            ref="business"
            :owner-id="user.id"
          />
          <DeviceSessions
            v-if="!user.mustChangePassword && visited.has('devices')"
            v-show="tab === 'devices'"
            ref="deviceSessions"
            @logout="identityRevoked"
          />
          <AdminAISettings
            v-if="user.role === 'ADMIN' && !user.mustChangePassword && visited.has('admin-ai')"
            v-show="tab === 'admin-ai'"
            ref="adminAISettings"
          />
          <ProfileSettings
            ref="profileSettings"
            v-show="tab === 'profile'"
            :user="user"
            @update="reloadUser"
            @logout="identityRevoked"
          />
          <AccountManagement
            ref="accountManagement"
            v-if="user.role === 'ADMIN' && !user.mustChangePassword && visited.has('accounts')"
            v-show="tab === 'accounts'"
          />
        </div>
      </el-scrollbar>
    </div>
    <footer class="api-app__footer">&copy; {{ new Date().getFullYear() }} 班务管理系统</footer>
    <el-dialog
      v-model="switchDialog"
      title="切换到老师工作台"
      width="min(480px, 92vw)"
      :close-on-click-modal="!switching"
      :close-on-press-escape="!switching"
      :show-close="!switching"
    >
      <p>搜索老师的手机号或昵称，进入该老师的页面、数据与权限。</p>
      <ManagedAccountSelect
        v-if="actor"
        :actor-id="actor.id"
        :model-value="candidate"
        :disabled="switching"
        @select="(id) => (candidate = id)"
      />
      <template #footer>
        <el-button :disabled="switching" @click="switchDialog = false">取消</el-button>
        <el-button
          type="primary"
          :loading="switching"
          :disabled="!candidate || candidate === actor?.id"
          @click="switchAccount"
          >进入工作台</el-button
        >
      </template>
    </el-dialog>
  </main>
</template>

<style scoped lang="scss">
.api-app {
  height: 100vh;
  height: 100svh;
  display: flex;
  flex-direction: column;
  background: var(--surface-page);
  color: var(--text-primary);
  &__header {
    height: 60px;
    flex-shrink: 0;
    padding: 0 20px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 16px;
    background: var(--theme-gradient);
    color: #fff;
  }
  &__brand,
  &__identity {
    display: flex;
    align-items: center;
    gap: 16px;
    min-width: 0;
  }
  &__brand {
    font-size: 20px;
    white-space: nowrap;
    flex-shrink: 0;
    img {
      width: 40px;
      height: 40px;
    }
  }
  &__identity {
    font-size: 13px;
  }
  &__managed {
    display: flex;
    align-items: center;
    gap: 4px;
    min-width: 0;
    padding: 0 8px 0 12px;
    height: 34px;
    border: 1px solid var(--el-color-warning-light-5);
    border-radius: 6px;
    background: var(--el-color-warning-light-9);
    color: var(--el-color-warning-dark-2);
  }
  &__managed-name {
    max-width: 120px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  &__return {
    flex-shrink: 0;
    color: var(--el-color-warning-dark-2);
  }
  &__body {
    display: flex;
    flex: 1;
    min-height: 0;
  }
  &__aside {
    width: auto;
    flex-shrink: 0;
    min-height: 0;
    overflow: visible;
  }
  &__content {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    :deep(.api-app__content-view) {
      padding: 16px;
    }
  }
  &__page {
    min-width: 0;
  }
  &__footer {
    height: 30px;
    flex-shrink: 0;
    display: flex;
    justify-content: center;
    align-items: center;
    background: var(--theme-footer-bg);
    color: #fff;
    font-size: 14px;
  }
  &--teacher {
    .api-app__content :deep(.api-app__content-view) {
      padding: 0;
      height: 100%;
    }
    .api-app__page {
      height: 100%;
    }
  }
  &__loading {
    display: grid;
    place-items: center;
    min-height: 100vh;
  }
  @media (max-width: 1000px) {
    &__header {
      padding: 0 12px;
      gap: 10px;
    }
    &__identity {
      gap: 10px;
    }
    &__brand {
      font-size: 17px;
      gap: 8px;
    }
    &__managed-name {
      max-width: 80px;
    }
  }
  @media (max-width: 760px) {
    &__brand strong {
      display: none;
    }
    &__identity {
      flex: 1;
      justify-content: flex-end;
    }
    &__managed-name {
      max-width: 60px;
    }
  }
  @media (max-width: 480px) {
    &__brand {
      display: none;
    }
    &__identity {
      gap: 6px;
    }
    &__managed {
      padding: 0 4px;
    }
    &__managed-name {
      max-width: 48px;
    }
  }
}
</style>
