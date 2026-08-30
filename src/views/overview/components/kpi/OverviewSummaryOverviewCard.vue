<script setup lang="ts">
/** 班级概况卡片 — 以特殊布局展示班均分、及格率与单元完成进度 */
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
    <!-- 卡片头部：图标 + 标题 + 单元进度 -->
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

    <!-- 指标区：学生人数与评语完成 -->
    <div class="overview-metrics">
      <div v-for="detail in card.details.slice(0, 2)" :key="detail.label" class="overview-metric">
        <span class="overview-label">{{ detail.label }}</span>
        <span class="overview-value">{{ detail.value }}</span>
      </div>
    </div>

    <!-- 进度占位区 -->
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
  border: 1px solid color-mix(in srgb, var(--summary-main) 18%, var(--border-muted));
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--summary-main) 8%, #ffffff) 0%, #ffffff 70%),
    #ffffff;
  box-shadow: 0 8px 22px rgba(15, 23, 42, 0.08);
  padding: 10px 12px;
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
  width: 32px;
  height: 32px;
  border-radius: 10px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  background: color-mix(in srgb, var(--summary-main) 14%, #ffffff);
  border: 1px solid color-mix(in srgb, var(--summary-main) 26%, #ffffff);
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
  font-size: 14px;
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
  padding: 4px 8px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--summary-main) 7%, #ffffff);
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
  background: color-mix(in srgb, var(--summary-main) 6%, #ffffff);
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
  font-size: 15px;
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
