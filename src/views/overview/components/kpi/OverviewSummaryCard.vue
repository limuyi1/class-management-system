<script setup lang="ts">
import type { DashboardSummaryCardType } from '@/types/HomeDashboard'

interface Props {
  card: DashboardSummaryCardType
  span: number
}

defineProps<Props>()
</script>

<template>
  <article
    class="summary-card"
    :class="[`is-${card.tone}`, `layout-${card.layout}`, `details-count-${card.details.length}`]"
    :style="{ gridColumn: `span ${span}` }"
  >
    <div class="summary-header">
      <div class="summary-icon">
        <font-awesome-icon :icon="['solid', card.icon]" />
      </div>
      <div class="summary-headline">
        <div class="summary-label">{{ card.label }}</div>
        <div class="summary-value-line">
          <span class="summary-value">{{ card.value }}</span>
          <span v-if="card.unit" class="summary-unit">{{ card.unit }}</span>
        </div>
      </div>
    </div>
    <div class="summary-detail-grid">
      <div
        v-for="detail in card.details"
        :key="`${card.key}-${detail.label}`"
        class="summary-detail-item"
      >
        <span class="detail-label">{{ detail.label }}</span>
        <span class="detail-value">{{ detail.value }}</span>
      </div>
    </div>
  </article>
</template>

<style scoped lang="scss">
.summary-card {
  --summary-main: #2563eb;
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

.summary-card.is-danger {
  --summary-main: #ef4444;
}

.summary-card.is-success {
  --summary-main: #2f9b7a;
}

.summary-card.is-info {
  --summary-main: #f59e0b;
}

.summary-card.is-warning {
  --summary-main: #3b82f6;
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

.summary-value-line {
  display: inline-flex;
  align-items: baseline;
  gap: 4px;
  color: #2563eb;
}

.summary-value {
  font-size: 17px;
  line-height: 1;
  font-weight: 700;
}

.summary-unit {
  font-size: 12px;
  line-height: 1;
  font-weight: 500;
}

.summary-detail-grid {
  flex: 1;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  align-content: start;
  gap: 6px 8px;
  padding-top: 2px;
  border-top: 1px solid #e8edf5;
}

.summary-card.layout-double .summary-detail-grid {
  grid-template-rows: 1fr;
}

.summary-card.details-count-1 .summary-detail-grid {
  grid-template-columns: 1fr;
  align-content: stretch;
}

.summary-card.details-count-1 .summary-detail-item {
  min-height: 54px;
  justify-content: center;
  gap: 12px;
}

.summary-card.details-count-1 .detail-label,
.summary-card.details-count-1 .detail-value,
.summary-card.details-count-2 .detail-label,
.summary-card.details-count-2 .detail-value {
  text-align: center;
}

.summary-card.details-count-2 .summary-detail-grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
  align-content: stretch;
}

.summary-card.details-count-2 .summary-detail-item {
  min-height: 54px;
  justify-content: center;
  gap: 12px;
}

.summary-card.layout-triple .summary-detail-grid,
.summary-card.layout-quad .summary-detail-grid {
  grid-template-rows: repeat(2, minmax(0, auto));
}

.summary-detail-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-width: 0;
  min-height: 24px;
  padding: 4px 8px;
  border: 0;
  border-radius: 8px;
  background: color-mix(in srgb, var(--summary-main) 6%, #ffffff);
}

.summary-card.layout-double .summary-detail-item {
  min-height: 24px;
}

.detail-label,
.detail-value {
  font-size: 12px;
  line-height: 1.2;
  color: #606266;
}

.detail-value {
  color: #303133;
}
</style>
