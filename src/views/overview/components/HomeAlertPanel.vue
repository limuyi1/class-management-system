<script setup lang="ts">
import { reactive } from 'vue'

import { homeDashboardConfig } from '@/config/home-dashboard'
import type { DashboardAlertGroupType } from '@/types/HomeDashboard'

interface Props {
  groups: DashboardAlertGroupType[]
}

defineProps<Props>()

const emit = defineEmits<{
  select: [name: string]
}>()

const expandedState = reactive({
  expanded: false
})

/**
 * 默认只展示预览人数，展开后展示当前分组完整名单
 */
const getVisibleItems = (group: DashboardAlertGroupType) => {
  return expandedState.expanded
    ? group.items
    : group.items.slice(0, homeDashboardConfig.alerts.displayCount)
}

const hasExpandableGroups = (groups: DashboardAlertGroupType[]) => {
  return groups.some((group) => group.items.length > homeDashboardConfig.alerts.displayCount)
}

const toggleExpanded = () => {
  expandedState.expanded = !expandedState.expanded
}
</script>

<template>
  <el-card class="home-side-card">
    <div class="panel-header">
      <div class="panel-title">重点学生预警</div>
      <div class="panel-subtitle">三类风险并排展示，尽量在一屏内直接扫到重点学生</div>
    </div>

    <div class="group-list">
      <div v-for="group in groups" :key="group.key" class="alert-group">
        <div class="group-title-row">
          <div class="group-title">{{ group.label }}</div>
          <div class="group-count">{{ group.items.length }} 人</div>
        </div>

        <div v-if="group.items.length" class="student-list">
          <button
            v-for="item in getVisibleItems(group)"
            :key="`${group.key}-${item.name}`"
            class="student-item"
            @click="emit('select', item.name)"
          >
            <div class="item-top">
              <div class="item-name">{{ item.name }}</div>
              <div class="item-badge">{{ item.badge }}</div>
            </div>
            <div class="item-subtitle">{{ item.subtitle }}</div>
          </button>
        </div>

        <el-empty v-else :image-size="48" description="暂无符合条件的学生"></el-empty>
      </div>
    </div>

    <button v-if="hasExpandableGroups(groups)" class="expand-action" @click="toggleExpanded">
      <font-awesome-icon :icon="['solid', expandedState.expanded ? 'chevron-up' : 'chevron-down']" />
      <span>{{ expandedState.expanded ? '收起' : '查看更多' }}</span>
    </button>
  </el-card>
</template>

<style scoped lang="scss">
.home-side-card {
  border-radius: 14px;
  border: 1px solid var(--border-muted);
  box-shadow: var(--shadow-card);

  :deep(.el-card__body) {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
}

.panel-header {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.panel-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
}

.panel-subtitle {
  font-size: 12px;
  color: var(--text-secondary);
}

.group-list {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}

.alert-group {
  padding: 8px;
  border-radius: 12px;
  background: #f8fafc;
  border: 1px solid #e5edf5;
  min-width: 0;
}

.group-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  margin-bottom: 6px;
}

.group-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-primary);
}

.group-count {
  font-size: 11px;
  color: #94a3b8;
}

.student-list {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.student-item {
  width: 100%;
  padding: 8px;
  border: 1px solid #e5edf5;
  border-radius: 9px;
  background: #fff;
  text-align: left;
  cursor: pointer;
  transition:
    transform 0.2s ease,
    border-color 0.2s ease,
    background-color 0.2s ease;

  &:hover {
    transform: translateY(-1px);
    border-color: color-mix(in srgb, var(--theme-primary) 28%, #ffffff);
    background: color-mix(in srgb, var(--theme-primary) 6%, #ffffff);
  }
}

.item-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
}

.item-name {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-primary);
  min-width: 0;
}

.item-subtitle {
  margin-top: 3px;
  font-size: 10px;
  color: var(--text-secondary);
  line-height: 1.35;
}

.item-badge {
  flex-shrink: 0;
  padding: 2px 6px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--theme-primary) 10%, #ffffff);
  color: var(--theme-primary);
  font-size: 10px;
  font-weight: 600;
}

:deep(.el-empty) {
  padding: 10px 0 2px;
}

:deep(.el-empty__description p) {
  font-size: 11px;
}

.expand-action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  align-self: center;
  padding: 2px 10px 0;
  border: 0;
  background: transparent;
  color: var(--theme-primary);
  font-size: 12px;
  cursor: pointer;
  transition: opacity 0.2s ease;

  &:hover {
    opacity: 0.82;
  }
}

@media (max-width: 1440px) {
  .group-list {
    grid-template-columns: 1fr;
  }
}
</style>
