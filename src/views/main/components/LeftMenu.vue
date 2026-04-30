<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import data from '@/config/menu'
import { useDataSourceStore } from '@/stores/data-source'

type MenuItemType = (typeof data)[number] & {
  targetPath?: string
  hidden?: boolean
}

const router = useRouter()
const store = useDataSourceStore()
const { enabledData: tableData } = storeToRefs(store)

const isCollapse = ref(false)

const hasData = computed(() => tableData.value?.length > 0)

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

const menuData = computed(() => {
  return data.filter((item) => !item.hidden).map((item) => {
    const newItem = { ...item }
    if (item.path === '/setting' || item.path === '/tools') {
      newItem.disabled = false
    } else {
      newItem.disabled = !hasData.value
    }

    return newItem
  })
})

const handleMenuClick = (item: MenuItemType) => {
  if (item.disabled) return
  const targetPath = item.targetPath || item.path
  if (item.path === '/setting') {
    router.push({ path: '/setting', query: { tab: hasData.value ? 'student-info' : 'system-backup' } })
  } else {
    router.push(targetPath)
  }
}
</script>

<template>
  <div class="left-menu" :class="{ collapsed: isCollapse }">
    <div
      v-for="item in menuData"
      :key="item.name"
      class="menu-item"
      :class="{
        active: activePath === item.path,
        disabled: item.disabled
      }"
      @click="handleMenuClick(item)"
    >
      <div class="menu-icon">
        <font-awesome-icon :icon="['solid', item.icon]" />
      </div>
      <span class="menu-title">{{ item.name }}</span>
    </div>

    <div class="collapse-button" @click="isCollapse = !isCollapse">
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
  pointer-events: none;
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
