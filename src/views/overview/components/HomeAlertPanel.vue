<script setup lang="ts">
import { computed, reactive } from 'vue'

import { homeDashboardConfig } from '@/config/home-dashboard'
import type { DashboardAlertGroupType } from '@/types/HomeDashboard'

interface Props {
  groups: DashboardAlertGroupType[]
  variant?: 'compact' | 'full'
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'full'
})

const emit = defineEmits<{
  select: [name: string]
  viewAll: []
}>()

const expandedState = reactive({
  expanded: false
})

const isCompact = computed(() => props.variant === 'compact')

/**
 * 默认只展示预览人数，展开后也限制展示数量，避免预警面板过高
 */
const getVisibleItems = (group: DashboardAlertGroupType) => {
  if (isCompact.value) {
    return group.items.slice(0, homeDashboardConfig.alerts.compactDisplayCount)
  }

  const maxCount = expandedState.expanded
    ? homeDashboardConfig.alerts.expandedDisplayCount
    : homeDashboardConfig.alerts.displayCount

  return group.items.slice(0, maxCount)
}

const hasExpandableGroups = (groups: DashboardAlertGroupType[]) => {
  return groups.some((group) => group.items.length > homeDashboardConfig.alerts.displayCount)
}

const toggleExpanded = () => {
  expandedState.expanded = !expandedState.expanded
}

const getSubtitleLines = (subtitle: string) => {
  return subtitle.split('\n').filter(Boolean)
}

const getGroupClass = (group: DashboardAlertGroupType) => `is-group-${group.key}`

const getLeadIcon = (group: DashboardAlertGroupType) => {
  if (group.key === 'persistentLowScore') return ['solid', 'circle-exclamation']
  if (group.key === 'largestFluctuation') return ['solid', 'wave-square']
  return ['solid', 'arrow-trend-down']
}
</script>

<template>
  <el-card class="home-side-card" :class="{ 'is-compact': isCompact }">
    <div class="panel-header">
      <div class="panel-title">重点学生预警</div>
    </div>

    <el-scrollbar class="alert-scrollbar">
      <div class="group-list">
        <div v-for="group in groups" :key="group.key" class="alert-group" :class="getGroupClass(group)">
          <div class="group-title-row">
            <div class="group-title">{{ group.label }}</div>
            <div class="group-count">{{ group.items.length }} 人</div>
          </div>

          <div v-if="group.items.length" class="student-list">
            <button
              v-for="(item, index) in getVisibleItems(group)"
              :key="`${group.key}-${item.name}`"
              class="student-item"
              :class="`is-rank-${index + 1}`"
              @click="emit('select', item.name)"
            >
              <div class="item-top">
                <div class="item-left">
                  <div class="item-order">{{ index + 1 }}</div>
                  <font-awesome-icon
                    v-if="index === 0"
                    class="item-lead-icon"
                    :icon="getLeadIcon(group)"
                  />
                  <div class="item-name">{{ item.name }}</div>
                </div>
                <div class="item-badge">{{ item.badge }}</div>
              </div>
              <div class="item-subtitle">
                <span v-for="line in getSubtitleLines(item.subtitle)" :key="line">{{ line }}</span>
              </div>
            </button>
          </div>

          <el-empty v-else :image-size="48" description="暂无符合条件的学生"></el-empty>
        </div>
      </div>
    </el-scrollbar>

    <button v-if="!isCompact && hasExpandableGroups(groups)" class="expand-action" @click="toggleExpanded">
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
    min-height: 0;
  }
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.panel-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
}

.header-action {
  flex-shrink: 0;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--theme-primary);
  font-size: 12px;
  cursor: pointer;
}

.alert-scrollbar {
  flex: 1;
  min-height: 0;
}

.group-list {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}

.alert-group {
  --group-main: var(--theme-primary);
  --group-soft: color-mix(in srgb, var(--group-main) 10%, #ffffff);
  --group-border: color-mix(in srgb, var(--group-main) 24%, #ffffff);
  --group-strong: var(--group-main);

  padding: 8px;
  border-radius: 12px;
  background: #f8fafc;
  border: 1px solid #e5edf5;
  min-width: 0;
}

.is-group-persistentLowScore {
  --group-main: #dc2626;
  --group-soft: #fef2f2;
  --group-border: #fecaca;
  --group-strong: #b91c1c;
}

.is-group-largestFluctuation {
  --group-main: #d97706;
  --group-soft: #fffbeb;
  --group-border: #fde68a;
  --group-strong: #f59e0b;
}

.is-group-declining {
  --group-main: #7c3aed;
  --group-soft: #f5f3ff;
  --group-border: #ddd6fe;
  --group-strong: #6d28d9;
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
  color: var(--group-main);
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
    border-color: var(--group-border);
    background: var(--group-soft);
  }
}

.item-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
}

.item-left {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.item-order {
  width: 22px;
  height: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  border-radius: 50%;
  background: var(--group-soft);
  color: var(--group-main);
  font-size: 11px;
  font-weight: 700;
}

.item-lead-icon {
  flex-shrink: 0;
  color: var(--group-strong);
  font-size: 12px;
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

  span {
    display: block;
  }
}

.item-badge {
  flex-shrink: 0;
  padding: 2px 6px;
  border-radius: 999px;
  background: var(--group-soft);
  color: var(--group-main);
  font-size: 10px;
  font-weight: 600;
}

.is-rank-1,
.is-rank-2,
.is-rank-3 {
  .item-order {
    color: #ffffff;
  }
}

.is-rank-1 {
  border-color: var(--group-border);
  background: linear-gradient(135deg, var(--group-soft), #ffffff 62%);

  .item-order {
    background: var(--group-strong);
  }

  .item-badge {
    background: var(--group-strong);
    color: #ffffff;
  }
}

.is-rank-2 {
  border-color: color-mix(in srgb, var(--group-main) 26%, #ffffff);
  background: linear-gradient(135deg, color-mix(in srgb, var(--group-main) 10%, #ffffff), #ffffff 62%);

  .item-order {
    background: color-mix(in srgb, var(--group-strong) 82%, #ffffff);
  }
}

.is-rank-3 {
  border-color: color-mix(in srgb, var(--group-main) 18%, #ffffff);
  background: linear-gradient(135deg, color-mix(in srgb, var(--group-main) 7%, #ffffff), #ffffff 62%);

  .item-order {
    background: color-mix(in srgb, var(--group-strong) 68%, #ffffff);
  }
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
  .home-side-card:not(.is-compact) .group-list {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .is-compact .group-list {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

.is-compact {
  :deep(.el-card__body) {
    gap: 8px;
  }

  .group-list {
    grid-template-columns: 1fr;
  }

  .alert-group {
    padding: 7px 8px;
  }

  .student-list {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 6px;
  }

  .student-item {
    min-width: 0;
    padding: 7px 8px;
  }

  .item-left {
    gap: 4px;
  }

  .item-order {
    width: 18px;
    height: 18px;
    font-size: 10px;
  }

  .item-subtitle {
    line-height: 1.4;
  }
}

@media (max-width: 960px) {
  .is-compact .group-list {
    grid-template-columns: 1fr;
  }

  .is-compact .student-list {
    grid-template-columns: 1fr;
  }
}
</style>
