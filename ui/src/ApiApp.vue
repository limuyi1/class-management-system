<script setup lang="ts">
import { ref } from 'vue'

import { ElMessage } from 'element-plus'

import { hasPendingAccountWrites } from '@/api/client'
import { useApiAccountSession } from '@/hooks/api/useApiAccountSession'
import { useWorkbenchNavigation } from '@/hooks/api/useWorkbenchNavigation'
import ThemeSelector from '@/components/ThemeSelector.vue'
import UserAccountMenu from '@/components/UserAccountMenu.vue'
import PageHeader from '@/components/PageHeader.vue'
import logo from '@/assets/main/logo.png'
import LoginPage from '@/views/auth/LoginPage.vue'
import SetupPage from '@/views/auth/SetupPage.vue'
import ProfileSettings from '@/views/auth/ProfileSettings.vue'
import AccountManagement from '@/views/auth/AccountManagement.vue'
import ServerTeachingWorkbench from '@/views/main/ServerTeachingWorkbench.vue'
import WorkspaceSelector from '@/components/workspace/WorkspaceSelector.vue'
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
        <ThemeSelector />
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
    <div v-if="managed" class="api-app__managed" role="status">
      <span>正在代管 {{ user.nickname }}</span>
      <el-button text :disabled="switching" @click="returnAdmin(false)">返回管理员</el-button>
    </div>
    <div :key="contextKey" class="api-app__body">
      <aside class="api-app__aside">
        <p v-if="user.role === 'ADMIN'" class="api-app__menu-label">
          {{ user.role === 'ADMIN' ? '管理工作台' : '教学工作台' }}
        </p>
        <el-scrollbar class="api-app__menu-scroll">
          <LeftMenu v-if="user.role === 'USER' && !user.mustChangePassword" />
          <nav v-else aria-label="工作台菜单">
            <button
              v-for="item in menuItems"
              :key="item.key"
              type="button"
              class="api-app__menu-item"
              :class="{ 'is-active': tab === item.key }"
              :aria-current="tab === item.key ? 'page' : undefined"
              :disabled="navigating"
              @click="selectPage(item.key)"
            >
              <font-awesome-icon :icon="['solid', item.icon]" /><span>{{ item.label }}</span>
            </button>
          </nav>
        </el-scrollbar>
        <div v-if="user.role === 'ADMIN'" class="api-app__aside-footer">让班务管理更轻松</div>
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
    <footer v-if="user.role === 'USER'" class="api-app__footer">
      &copy; {{ new Date().getFullYear() }} 班务管理系统
    </footer>
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
    min-height: 60px;
    padding: 10px 24px;
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
  }
  &__brand {
    font-size: 20px;
    white-space: nowrap;
    img {
      width: 40px;
      height: 40px;
    }
  }
  &__identity {
    font-size: 13px;
    flex-wrap: wrap;
    :deep(.el-button) {
      color: #fff;
    }
  }
  &__managed {
    padding: 6px 24px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: var(--el-color-warning-light-9);
    color: var(--el-color-warning-dark-2);
    font-size: 13px;
  }
  &__body {
    display: flex;
    flex: 1;
    min-height: 0;
  }
  &__aside {
    width: 210px;
    flex-shrink: 0;
    background: var(--surface-card);
    border-right: 1px solid var(--border-muted);
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  &__menu-scroll {
    flex: 1;
    min-height: 0;
  }
  &__menu-label {
    padding: 20px 20px 8px;
    font-size: 12px;
    color: var(--text-secondary);
  }
  &__menu-item {
    width: 100%;
    border: 0;
    border-left: 3px solid transparent;
    background: transparent;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 16px 20px;
    text-align: left;
    font: inherit;
    font-size: 14px;
    color: var(--text-primary);
    cursor: pointer;
    &:hover {
      background: var(--surface-page);
    }
    &.is-active {
      background: var(--theme-menu-active-bg);
      color: var(--theme-menu-active);
      border-left-color: var(--theme-primary);
      font-weight: 600;
    }
    &:focus-visible {
      outline: 2px solid var(--theme-primary);
      outline-offset: -3px;
    }
    svg {
      width: 20px;
    }
  }
  &__aside-footer {
    margin-top: auto;
    padding: 24px 20px;
    color: var(--text-secondary);
    font-size: 12px;
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
    .api-app__header {
      padding: 0 20px;
      height: 60px;
    }
    .api-app__aside {
      width: auto;
      overflow: visible;
      border: 0;
    }
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
  @media (max-width: 760px) {
    &__header {
      padding: 12px;
      flex-wrap: wrap;
    }
    &__brand {
      font-size: 17px;
    }
    &__aside {
      width: 150px;
    }
    &__menu-item {
      padding: 14px 10px;
      gap: 8px;
      font-size: 13px;
    }
    &__menu-label,
    &__aside-footer {
      padding: 16px 10px;
    }
    &__content :deep(.api-app__content-view) {
      padding: 10px;
    }
  }
  @media (max-width: 480px) {
    &__managed {
      padding: 6px 24px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: var(--el-color-warning-light-9);
      color: var(--el-color-warning-dark-2);
      font-size: 13px;
    }
    &__body {
      flex-direction: column;
    }
    &__aside {
      width: 100%;
      max-height: 150px;
      border-right: 0;
      border-bottom: 1px solid var(--border-muted);
    }
    &__menu-label,
    &__aside-footer {
      display: none;
    }
    nav {
      display: flex;
      flex-wrap: wrap;
    }
    &__menu-item {
      width: 50%;
    }
  }
}
</style>
