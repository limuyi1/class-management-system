<script setup lang="ts">
import { computed } from 'vue'

import OverviewSummaryCard from '@/views/overview/components/kpi/OverviewSummaryCard.vue'
import OverviewSummaryOverviewCard from '@/views/overview/components/kpi/OverviewSummaryOverviewCard.vue'

import type { DashboardSummaryCardType } from '@/types/HomeDashboard'

interface Props {
  /** 汇总卡片数据，包含四类分组卡片 + 班级概况卡片 */
  summaryCards: DashboardSummaryCardType[]
}

const props = defineProps<Props>()

/** 统计类卡片：立即关注、值得鼓励、中段变化、波动观察（不含班级概况） */
const statCards = computed(() => props.summaryCards.filter((card) => card.key !== 'overview'))
/** 班级概况卡片，单独展示 */
const overviewCard = computed(
  () => props.summaryCards.find((card) => card.key === 'overview') || null
)

/**
 * 根据卡片类型返回 grid 列跨度。
 * attention 和 overview 占 2 列，其他卡片占 1 列。
 * 响应式布局下统一为 1 列。
 */
const getCardSpan = (card: DashboardSummaryCardType) => {
  switch (card.key) {
    case 'attention':
      return 2
    case 'overview':
      return 2
    default:
      return 1
  }
}
</script>

<template>
  <section class="home-kpi-strip">
    <div class="summary-grid">
      <overview-summary-card
        v-for="card in statCards"
        :key="card.key"
        :card="card"
        :span="getCardSpan(card)"
      />

      <overview-summary-overview-card
        v-if="overviewCard"
        :card="overviewCard"
        :span="getCardSpan(overviewCard)"
      />
    </div>
  </section>
</template>

<style scoped lang="scss">
.home-kpi-strip {
  display: block;
  width: 100%;
  min-width: 0;
  box-sizing: border-box;
}

.summary-grid {
  width: 100%;
  min-width: 0;
  box-sizing: border-box;
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 12px;
}

@media (max-width: 1440px) {
  .summary-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .summary-card,
  .summary-card.summary-card--overview {
    grid-column: span 1 !important;
  }
}

@media (max-width: 1280px) {
  .summary-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 768px) {
  .summary-grid {
    grid-template-columns: 1fr;
  }
}
</style>
