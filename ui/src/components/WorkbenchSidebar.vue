<script setup lang="ts">
import type { WorkbenchMenuItemType } from '@/types/Workbench'

withDefaults(
  defineProps<{
    items: WorkbenchMenuItemType[]
    activeKey: string
    collapsed: boolean
    navigating?: boolean
  }>(),
  { navigating: false }
)
const emit = defineEmits<{
  select: [key: string]
  'update:collapsed': [value: boolean]
}>()
</script>

<template>
  <div class="left-menu" :class="{ collapsed }">
    <el-scrollbar class="left-menu__scroll">
      <nav aria-label="工作台菜单">
        <button
          v-for="item in items"
          :key="item.key"
          type="button"
          class="menu-item"
          :class="{ active: activeKey === item.key, disabled: item.disabled }"
          :title="collapsed ? item.label : item.title || item.label"
          :aria-current="activeKey === item.key ? 'page' : undefined"
          :aria-disabled="item.disabled || undefined"
          :disabled="navigating"
          @click="emit('select', item.key)"
        >
          <span class="menu-icon"><font-awesome-icon :icon="['solid', item.icon]" /></span>
          <span class="menu-title">{{ item.label }}</span>
        </button>
      </nav>
    </el-scrollbar>
    <button
      type="button"
      class="collapse-button"
      :aria-label="collapsed ? '展开菜单' : '折叠菜单'"
      :aria-expanded="!collapsed"
      @click="emit('update:collapsed', !collapsed)"
    >
      <font-awesome-icon :icon="['solid', collapsed ? 'chevron-right' : 'chevron-left']" />
    </button>
  </div>
</template>

<style scoped lang="scss">
.left-menu {
  position: relative;
  z-index: 2;
  width: 150px;
  height: 100%;
  min-height: 0;
  flex-shrink: 0;
  background: var(--surface-card, #fff);
  border-right: 1px solid var(--border-muted, #e6e6e6);
  transition: width 0.3s ease;
  &.collapsed {
    width: 64px;
  }
  &__scroll {
    height: 100%;
  }
}
.menu-item {
  position: relative;
  display: flex;
  align-items: center;
  width: 100%;
  height: 56px;
  padding: 0 12px 0 16px;
  border: 0;
  background: transparent;
  color: var(--text-primary, #333);
  font: inherit;
  text-align: left;
  cursor: pointer;
  white-space: nowrap;
  transition:
    background-color 0.2s,
    color 0.2s;
  &:hover {
    background: var(--surface-page, #f5f5f5);
  }
  &.active {
    background: var(--theme-menu-active-bg);
    color: var(--theme-menu-active);
    &::before {
      content: '';
      position: absolute;
      left: 0;
      top: 0;
      width: 3px;
      height: 100%;
      background: var(--theme-menu-active);
    }
  }
  &.disabled {
    color: var(--el-text-color-disabled);
    cursor: not-allowed;
  }
  &.disabled:hover {
    background: transparent;
  }
  &:focus-visible {
    outline: 2px solid var(--theme-primary);
    outline-offset: -2px;
  }
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
}
.menu-title {
  font-size: 14px;
  overflow: hidden;
  text-overflow: ellipsis;
}
.collapsed .menu-item {
  padding-left: 20px;
}
.collapsed .menu-icon {
  margin-right: 0;
}
.collapsed .menu-title {
  width: 0;
  opacity: 0;
}
.collapse-button {
  position: absolute;
  z-index: 3;
  right: -12px;
  top: 50%;
  transform: translateY(-50%);
  width: 24px;
  height: 24px;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--surface-card, #fff);
  border: 1px solid var(--border-muted, #e6e6e6);
  border-radius: 50%;
  color: var(--text-secondary, #666);
  cursor: pointer;
  &:hover {
    color: var(--theme-primary);
  }
  &:focus-visible {
    outline: 2px solid var(--theme-primary);
    outline-offset: 2px;
  }
}
</style>
