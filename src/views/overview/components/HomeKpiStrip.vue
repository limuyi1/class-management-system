<script setup lang="ts">
import { computed } from 'vue'

import OverviewSummaryCard from '@/views/overview/components/kpi/OverviewSummaryCard.vue'
import OverviewSummaryOverviewCard from '@/views/overview/components/kpi/OverviewSummaryOverviewCard.vue'

import type { DashboardSummaryCardType } from '@/types/HomeDashboard'

interface Props {
  summaryCards: DashboardSummaryCardType[]
}

const props = defineProps<Props>()

const statCards = computed(() => props.summaryCards.filter((card) => card.key !== 'overview'))
const overviewCard = computed(
  () => props.summaryCards.find((card) => card.key === 'overview') || null
)

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
