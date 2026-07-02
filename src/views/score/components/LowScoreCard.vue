<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'

import { useDataSourceStore } from '@/stores/data-source'
import { useConfigurationStore } from '@/stores/configuration'
import { useScoreStatistics } from '@/hooks/useScoreStatistics'
import { useScoreDistributionActions } from '@/hooks/useScoreDistributionActions'

import ThresholdStudents from '@/views/score/components/statistics/ThresholdStudents.vue'

const store = useDataSourceStore()
const configuration = useConfigurationStore()

const { students: originList } = storeToRefs(store)

const scorePropRef = computed(() => configuration.inputScoreTab)

const {
  threshold,
  thresholdMode,
  effectiveThreshold,
  belowThresholdStudents,
  scoreStats,
  getScore
} = useScoreStatistics({
  students: computed(() => originList.value),
  scoreProp: scorePropRef
})

const { downloadImage } = useScoreDistributionActions({
  scoreStats,
  belowThresholdStudents,
  threshold: effectiveThreshold,
  getScore
})
</script>

<template>
  <el-card class="low-score-card">
    <div class="card-header">
      <div class="card-title">
        <font-awesome-icon :icon="['solid', 'triangle-exclamation']" />
        <span>低分学生预警</span>
      </div>
    </div>

    <template v-if="scoreStats">
      <threshold-students
        :threshold="threshold"
        :effective-threshold="effectiveThreshold"
        :threshold-mode="thresholdMode"
        :avg-score="Number(scoreStats.avgScore)"
        :students="belowThresholdStudents"
        :get-score="getScore"
        @update:threshold="(value) => (threshold = value)"
        @update:threshold-mode="(mode) => (thresholdMode = mode)"
        @download="downloadImage"
      />
    </template>

    <div v-else class="empty-hint">
      <font-awesome-icon :icon="['solid', 'chart-simple']" />
      <span>暂无成绩数据</span>
    </div>
  </el-card>
</template>

<style scoped lang="scss">
.low-score-card {
  border-radius: 12px;
  background: #fff;
  border: 1px solid var(--border-muted);
  box-shadow: var(--shadow-card);

  :deep(.el-card__body) {
    background: #fff;
  }

  .card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 10px;

    .card-title {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 14px;
      font-weight: 600;
      color: #334155;

      svg {
        color: #f59e0b;
        font-size: 16px;
      }
    }
  }

  .empty-hint {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 40px 0;
    color: #94a3b8;

    svg {
      font-size: 40px;
      margin-bottom: 12px;
    }
  }
}
</style>
