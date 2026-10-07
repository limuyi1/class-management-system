<script setup lang="ts">
/** 左侧导航菜单 — 渲染菜单项、管理折叠状态，并根据数据导入情况控制可用性 */
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { ElMessage } from 'element-plus'

import data from '@/config/menu'
import { useDataSourceStore } from '@/stores/data-source'
import { useConfigurationStore } from '@/stores/configuration'

/** 菜单项类型：在配置项基础上扩展实际跳转路径与隐藏标记 */
type MenuItemType = (typeof data)[number] & {
  targetPath?: string
  hidden?: boolean
}

const router = useRouter()
const store = useDataSourceStore()
const configuration = useConfigurationStore()
const { enabledData: tableData } = storeToRefs(store)

/** 菜单折叠状态，直接读写 configuration store 以与其它布局共享 */
const isCollapse = computed({
  get: () => configuration.menuCollapsed,
  set: (value: boolean) => {
    configuration.menuCollapsed = value
  }
})

/** 是否已导入学生数据，用于控制菜单项的禁用状态 */
const hasData = computed(() => tableData.value?.length > 0)

/**
 * 当前激活的菜单路径。
 * 概览页与工具页下的子路由统一映射到其父级菜单项，保证高亮正确；
 * 其余情况回退到当前路径或首个菜单项。
 */
const activePath = computed(() => {
  const currentPath = router.currentRoute.value?.path

  if (currentPath === '/overview') {
    return '/overview'
  }

  if (currentPath?.startsWith('/tools')) {
    return '/tools'
  }

  return currentPath || data[0].path
})

/**
 * 生成实际渲染的菜单项：
 * 过滤隐藏项，并按是否已导入数据设置禁用状态（学生、设置与工具页始终可用）。
 */
const menuData = computed(() => {
  return data
    .filter((item) => !item.hidden)
    .map((item) => {
      const newItem = { ...item }
      if (item.path === '/setting' || item.path === '/tools' || item.path === '/student-info') {
        newItem.disabled = false
      } else {
        newItem.disabled = !hasData.value
      }

      return newItem
    })
})

/**
 * 计算菜单项的悬浮提示文案。
 * 折叠时仅显示名称，禁用时提示先导入数据，其余情况不显示提示。
 *
 * @param item 菜单项
 * @returns 提示文案，无需提示时返回 undefined
 */
const getMenuItemTitle = (item: MenuItemType) => {
  if (isCollapse.value) return item.name
  if (item.disabled) return '请先导入学生数据'
  return undefined
}

/**
 * 处理菜单点击。
 * 禁用项给出提示；设置页根据是否已有数据携带不同的默认标签页跳转。
 *
 * @param item 被点击的菜单项
 */
const handleMenuClick = (item: MenuItemType) => {
  if (item.disabled) {
    ElMessage.warning('请先在“设置”页面导入学生数据')
    return
  }
  const targetPath = item.targetPath || item.path
  if (item.path === '/setting') {
    router.push({
      path: '/setting',
      query: { tab: hasData.value ? 'label-maintenance' : 'system-backup' }
    })
  } else {
    router.push(targetPath)
  }
}
</script>

<template>
  <div class="left-menu" :class="{ collapsed: isCollapse }">
    <!-- 菜单项列表 -->
    <div
      v-for="item in menuData"
      :key="item.name"
      class="menu-item"
      :class="{
        active: activePath === item.path,
        disabled: item.disabled
      }"
      :title="getMenuItemTitle(item)"
      @click="handleMenuClick(item)"
    >
      <div class="menu-icon">
        <font-awesome-icon :icon="['solid', item.icon]" />
      </div>
      <span class="menu-title">{{ item.name }}</span>
    </div>

    <!-- 折叠/展开按钮 -->
    <div
      class="collapse-button"
      role="button"
      :aria-label="isCollapse ? '展开菜单' : '折叠菜单'"
      tabindex="0"
      @click="isCollapse = !isCollapse"
      @keydown.enter.prevent="isCollapse = !isCollapse"
      @keydown.space.prevent="isCollapse = !isCollapse"
    >
      <font-awesome-icon :icon="['solid', isCollapse ? 'chevron-right' : 'chevron-left']" />
    </div>
  </div>
</template>

<style scoped lang="scss">
.left-menu {
  width: 150px;
  height: 100%;
  background-color: #fff;
  border-right: 1px solid #e6e6e6;
  transition: width 0.3s ease;
  position: relative;
}

.left-menu.collapsed {
  width: 64px;
}

.menu-item {
  position: relative;
  display: flex;
  align-items: center;
  height: 56px;
  padding-left: 16px;
  cursor: pointer;
  color: #333;
  transition:
    background-color 0.2s,
    color 0.2s,
    padding-left 0.3s ease;
  white-space: nowrap;
  line-height: 56px;
}

.left-menu.collapsed .menu-item {
  padding-left: 20px; /* 折叠时图标居中 */
}

.menu-item:hover {
  background-color: #f5f5f5;
}

.menu-item.active {
  background-color: var(--theme-menu-active-bg);
  color: var(--theme-menu-active);
}

.menu-item.active:before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  width: 3px;
  height: 100%;
  background-color: var(--theme-menu-active);
}

.menu-item.disabled {
  color: #c0c4cc;
  cursor: not-allowed;
}

.menu-item.disabled:hover {
  background-color: transparent;
}

.menu-icon {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 12px;
  font-size: 18px;
  flex-shrink: 0;
  transition: margin-right 0.3s ease;
}

.left-menu.collapsed .menu-icon {
  margin-right: 0;
}

.menu-title {
  font-size: 14px;
  overflow: hidden;
  white-space: nowrap;
  max-width: 200px; /* 足够大以便过渡 */
  opacity: 1;
  transition:
    max-width 0.3s ease,
    opacity 0.2s ease;
}

.left-menu.collapsed .menu-title {
  max-width: 0;
  opacity: 0;
}

.collapse-button {
  position: absolute;
  z-index: 11;
  right: -12px;
  top: 50%;
  transform: translateY(-50%);
  width: 24px;
  height: 24px;
  font-size: 15px;
  background-color: #fff;
  border: 1px solid #e6e6e6;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(24, 26, 27, 0.2);
  cursor: pointer;
  transition:
    color 0.2s,
    background-color 0.2s;
}

.collapse-button:hover {
  color: rgba(24, 26, 27, 0.55);
  background-color: #f5f5f5;
}
</style>
