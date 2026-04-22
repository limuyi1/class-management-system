<script setup lang="ts">
import type { DashboardRankingGroupType } from '@/types/HomeDashboard'

interface Props {
  groups: DashboardRankingGroupType[]
}

defineProps<Props>()

const emit = defineEmits<{
  select: [name: string]
}>()
</script>

<template>
  <el-card class="home-side-card">
    <div class="panel-header">
      <div class="panel-title">学生掌握情况榜单</div>
      <div class="panel-subtitle">三类榜单并排展示，保留固定 Top 3，方便一屏快速扫视</div>
    </div>

    <div class="ranking-grid">
      <div v-for="group in groups" :key="group.key" class="ranking-card">
        <div class="ranking-title-row">
          <div class="ranking-title">{{ group.label }}</div>
          <div class="ranking-count">{{ group.items.length }} 人</div>
        </div>

        <div v-if="group.items.length" class="ranking-list">
          <button
            v-for="(item, index) in group.items"
            :key="`${group.key}-${item.name}`"
            class="ranking-item"
            @click="emit('select', item.name)"
          >
            <div class="item-top">
              <div class="item-left">
                <div class="item-order">{{ index + 1 }}</div>
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

.ranking-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}

.ranking-card {
  padding: 8px;
  border-radius: 12px;
  background: #f8fafc;
  border: 1px solid #e5edf5;
  min-width: 0;
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
  color: var(--text-primary);
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
  background: color-mix(in srgb, var(--theme-primary) 12%, #ffffff);
  color: var(--theme-primary);
  font-size: 11px;
  font-weight: 700;
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

@media (max-width: 1440px) {
  .ranking-grid {
    grid-template-columns: 1fr;
  }
}
</style>
