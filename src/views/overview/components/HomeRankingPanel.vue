<script setup lang="ts">
import { computed } from 'vue'

import { homeDashboardConfig } from '@/config/home-dashboard'
import type { DashboardRankingGroupType } from '@/types/HomeDashboard'

interface Props {
  groups: DashboardRankingGroupType[]
  variant?: 'compact' | 'full'
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'full'
})

const emit = defineEmits<{
  select: [name: string]
  viewAll: []
}>()

const isCompact = computed(() => props.variant === 'compact')

const getVisibleItems = (group: DashboardRankingGroupType) => {
  if (isCompact.value) {
    return group.items.slice(0, homeDashboardConfig.rankings.compactDisplayCount)
  }

  return group.items
}

const getGroupClass = (group: DashboardRankingGroupType) => `is-group-${group.key}`

const getLeadIcon = (group: DashboardRankingGroupType) => {
  if (group.key === 'stableTopFive') return ['solid', 'flag']
  return ['solid', 'arrow-trend-up']
}
</script>

<template>
  <el-card class="home-side-card" :class="{ 'is-compact': isCompact }">
    <div class="panel-header">
      <div class="panel-title">学生掌握情况榜单</div>
      <button v-if="!isCompact" class="header-action" @click="emit('viewAll')">查看榜单</button>
    </div>

    <div class="ranking-grid">
      <div v-for="group in groups" :key="group.key" class="ranking-card" :class="getGroupClass(group)">
        <div class="ranking-title-row">
          <div class="ranking-title">{{ group.label }}</div>
          <div class="ranking-count">{{ group.items.length }} 人</div>
        </div>

        <div v-if="group.items.length" class="ranking-list">
          <button
            v-for="(item, index) in getVisibleItems(group)"
            :key="`${group.key}-${item.name}`"
            class="ranking-item"
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
            <div class="item-subtitle">{{ item.subtitle }}</div>
          </button>
        </div>

        <el-empty v-else :image-size="56" description="暂无数据"></el-empty>
      </div>
    </div>
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

.ranking-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}

.ranking-card {
  --group-main: var(--theme-primary);
  --group-soft: color-mix(in srgb, var(--group-main) 10%, #ffffff);
  --group-border: color-mix(in srgb, var(--group-main) 22%, #ffffff);
  --group-strong: var(--group-main);

  padding: 8px;
  border-radius: 12px;
  background: #f8fafc;
  border: 1px solid #e5edf5;
  min-width: 0;
}

.is-group-stableTopFive {
  --group-main: #2563eb;
  --group-soft: #eff6ff;
  --group-border: #bfdbfe;
  --group-strong: #1d4ed8;
}

.is-group-mostImproved {
  --group-main: #059669;
  --group-soft: #ecfdf5;
  --group-border: #a7f3d0;
  --group-strong: #10b981;
}

.ranking-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  margin-bottom: 6px;
}

.ranking-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--group-main);
}

.ranking-count {
  font-size: 11px;
  color: #94a3b8;
}

.ranking-list {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.ranking-item {
  width: 100%;
  padding: 8px;
  border: 0;
  border-radius: 9px;
  background: #fff;
  cursor: pointer;
  text-align: left;
  border: 1px solid #e5edf5;
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

@media (max-width: 1440px) {
  .home-side-card:not(.is-compact) .ranking-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .is-compact .ranking-grid {
    grid-template-columns: 1fr;
  }
}

.is-compact {
  :deep(.el-card__body) {
    gap: 8px;
  }

  .ranking-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .ranking-card {
    padding: 7px 8px;
  }

  .ranking-title-row {
    margin-bottom: 6px;
  }

  .ranking-list {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 5px;
  }

  .ranking-item {
    min-width: 0;
    padding: 6px;
  }

  .item-top {
    gap: 4px;
  }

  .item-left {
    gap: 4px;
  }

  .item-order {
    width: 18px;
    height: 18px;
    font-size: 10px;
  }

  .item-name {
    font-size: 11px;
  }

  .item-badge {
    padding: 1px 5px;
    font-size: 10px;
  }

  .item-subtitle {
    font-size: 10px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

@media (max-width: 960px) {
  .is-compact .ranking-grid {
    grid-template-columns: 1fr;
  }

  .is-compact .ranking-list {
    grid-template-columns: 1fr;
  }
}
</style>
