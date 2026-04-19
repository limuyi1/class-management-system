<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'

import { useDataSourceStore } from '@/stores/data-source'
import { useConfigurationStore } from '@/stores/configuration'
import { useScoreStatistics } from '@/hooks/useScoreStatistics'
import { useScoreDistributionActions } from '@/hooks/useScoreDistributionActions'

import ScoreSummary from '@/views/score/components/statistics/ScoreSummary.vue'
import ThresholdStudents from '@/views/score/components/statistics/ThresholdStudents.vue'
import ScoreRangeList from '@/views/score/components/statistics/ScoreRangeList.vue'
import LowScorePanel from '@/views/score/components/statistics/LowScorePanel.vue'

const store = useDataSourceStore()
const configuration = useConfigurationStore()

const { items: originList } = storeToRefs(store)

const scorePropRef = computed(() => configuration.inputScoreTab)

const { threshold, belowThresholdStudents, scoreStats, getScore } = useScoreStatistics({
  students: computed(() => originList.value),
  scoreProp: scorePropRef
})

const { copyToClipboard, downloadImage } = useScoreDistributionActions({
  scoreStats,
  belowThresholdStudents,
  threshold,
  getScore
})
</script>

<template>
  <el-card class="statistics-card__wrapper">
    <div class="card-header">
      <div class="card-title">
        <font-awesome-icon :icon="['solid', 'list']" />
        <span>分数分布</span>
      </div>
      <el-button v-if="scoreStats" type="primary" size="small" round @click="copyToClipboard">
        <template #icon><font-awesome-icon :icon="['solid', 'copy']" /></template>
        复制
      </el-button>
    </div>

    <template v-if="scoreStats">
      <score-summary :score-stats="scoreStats" />
      <threshold-students
        :threshold="threshold"
        :students="belowThresholdStudents"
        :get-score="getScore"
        @update:threshold="(value) => (threshold = value)"
        @download="downloadImage"
      />
      <score-range-list :score-stats="scoreStats" />
      <low-score-panel :score-stats="scoreStats" />
    </template>

    <div v-else class="empty-hint">
      <font-awesome-icon :icon="['solid', 'chart-simple']" />
      <span>暂无成绩数据</span>
    </div>
  </el-card>
</template>

<style scoped lang="scss">
.statistics-card__wrapper {
  border-radius: 10px;
  height: 100%;

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
        color: var(--theme-primary);
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
