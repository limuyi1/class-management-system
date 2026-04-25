<script setup lang="ts">
import type { DashboardSummaryCardType } from '@/types/HomeDashboard'

interface Props {
  /** 班级概况卡片数据（特殊布局，与其他汇总卡片不同） */
  card: DashboardSummaryCardType
  /** Grid 列跨度 */
  span: number
}

defineProps<Props>()
</script>

<template>
  <article
    class="summary-card summary-card--overview"
    :class="`is-${card.tone}`"
    :style="{ gridColumn: `span ${span}` }"
  >
    <div class="summary-header">
      <div class="summary-icon">
        <font-awesome-icon :icon="['solid', card.icon]" />
      </div>
      <div class="summary-headline summary-headline--overview">
        <div class="summary-label">{{ card.label }}</div>
        <div class="overview-header-progress">
          <span class="overview-header-label">{{ card.details[2]?.label }}</span>
          <span class="overview-header-value">{{ card.details[2]?.value }}</span>
        </div>
      </div>
    </div>

    <div class="overview-metrics">
      <div v-for="detail in card.details.slice(0, 2)" :key="detail.label" class="overview-metric">
        <span class="overview-label">{{ detail.label }}</span>
        <span class="overview-value">{{ detail.value }}</span>
      </div>
    </div>

    <div class="overview-progress">
      <span class="overview-progress-placeholder"></span>
    </div>
  </article>
</template>

<style scoped lang="scss">
.summary-card {
  --summary-main: #3b82f6;
  --summary-soft: color-mix(in srgb, var(--summary-main) 6%, #ffffff);
  border-radius: 14px;
  border: 1px solid var(--border-muted);
  background: linear-gradient(180deg, var(--summary-soft) 0%, #ffffff 62%), #ffffff;
  box-shadow: var(--shadow-card);
  padding: 8px 10px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-height: 116px;
}

.summary-header {
  display: flex;
  align-items: center;
  gap: 8px;
}

.summary-icon {
  width: 30px;
  height: 30px;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  background: color-mix(in srgb, var(--summary-main) 10%, #ffffff);
  border: 1px solid color-mix(in srgb, var(--summary-main) 20%, #ffffff);
  color: var(--summary-main);
  font-size: 14px;
}

.summary-headline {
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
}

.summary-label {
  font-size: 13px;
  line-height: 1.2;
  font-weight: 600;
  color: #303133;
}

.summary-headline--overview {
  width: 100%;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.overview-header-progress {
  display: inline-flex;
  align-items: baseline;
  gap: 4px;
  white-space: nowrap;
}

.overview-header-label {
  font-size: 12px;
  color: #606266;
}

.overview-header-value {
  font-size: 13px;
  font-weight: 700;
  color: #2563eb;
}

.overview-metrics {
  flex: 1;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  padding-top: 2px;
  border-top: 1px solid #e8edf5;
  align-content: stretch;
}

.overview-metric,
.overview-progress {
  display: flex;
  align-items: center;
  gap: 8px;
}

.overview-metric {
  min-height: 54px;
  padding: 6px 8px;
  border-radius: 8px;
  background: color-mix(in srgb, #3b82f6 6%, #ffffff);
  flex-direction: column;
  justify-content: center;
  align-items: center;
  text-align: center;
}

.overview-label {
  font-size: 12px;
  color: #606266;
}

.overview-value,
.overview-progress-value {
  font-size: 13px;
  font-weight: 700;
  color: #2563eb;
}

.overview-progress {
  min-height: 0;
  padding: 0;
  border-top: 0;
}

.overview-progress-placeholder {
  display: block;
  height: 0;
}
</style>
