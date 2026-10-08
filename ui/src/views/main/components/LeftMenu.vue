<script setup lang="ts">
/** 左侧导航菜单 — 渲染菜单项、管理折叠状态，并根据数据导入情况控制可用性 */
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { ElMessage } from 'element-plus'

import WorkbenchSidebar from '@/components/WorkbenchSidebar.vue'
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
/** 将业务菜单映射为共用侧栏的展示数据。 */
const sidebarItems = computed(() =>
  menuData.value.map((item) => ({
    key: item.path,
    label: item.name,
    icon: item.icon,
    disabled: item.disabled,
    title: getMenuItemTitle(item)
  }))
)

/** 共用侧栏只发送导航目标，业务层负责可用性检查与跳转。 */
function selectMenu(key: string): void {
  const item = menuData.value.find((item) => item.path === key)
  if (item) handleMenuClick(item)
}
</script>

<template>
  <WorkbenchSidebar
    v-model:collapsed="isCollapse"
    :items="sidebarItems"
    :active-key="activePath"
    @select="selectMenu"
  />
</template>
