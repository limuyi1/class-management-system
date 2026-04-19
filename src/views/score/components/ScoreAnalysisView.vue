<script setup lang="ts">
import StatisticsRateCard from '@/views/score/components/StatisticsRateCard.vue'
import StatisticsNumCard from '@/views/score/components/StatisticsNumCard.vue'
import LowScoreCard from '@/views/score/components/LowScoreCard.vue'
</script>

<template>
  <div class="score-analysis-view__wrapper">
    <div class="analysis-header">
      <div class="title">成绩统计</div>
    </div>

    <el-scrollbar>
      <div class="analysis-body">
        <statistics-num-card />
        <low-score-card />
        <statistics-rate-card />
      </div>
    </el-scrollbar>
  </div>
</template>

<style scoped lang="scss">
.score-analysis-view__wrapper {
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding-right: 10px;
  box-sizing: border-box;
}

.analysis-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #fff;
  border: 1px solid var(--border-muted);
  border-radius: 12px;
  box-shadow: var(--shadow-card);
  padding: 10px 12px;

  .title {
    font-size: 14px;
    font-weight: 600;
    color: var(--text-primary);
  }
}

.analysis-body {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding-right: 2px;
}

:deep(.el-scrollbar__wrap) {
  padding-right: 6px;
  box-sizing: border-box;
}
</style>
