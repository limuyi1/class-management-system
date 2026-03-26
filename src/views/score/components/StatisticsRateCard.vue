<script setup lang="ts">
import { ref } from 'vue'
import { useTransition } from '@vueuse/core'
import DownloadBtn from '@/views/score/components/DownloadBtn.vue'

import { useDataSourceStore } from '@/stores/data-source'

const store = useDataSourceStore()

const comprehensiveRatingRate = ref(0)
const average = ref(0) // 平均分
const passRate = ref(0) // 及格率
const excellentRate = ref(0) // 优秀率
const optimumRate = ref(0) // 特优率
const lowScoreRate = ref(0) // 低分率

const outputComprehensiveRatingRate = useTransition(comprehensiveRatingRate, {
  duration: 1500
})
const outputAverage = useTransition(average, {
  duration: 1500
})
const outputPassRate = useTransition(passRate, {
  duration: 1500
})
const outputExcellentRate = useTransition(excellentRate, {
  duration: 1500
})
const outputOptimumRate = useTransition(optimumRate, {
  duration: 1500
})
const outputLowScoreRate = useTransition(lowScoreRate, {
  duration: 1500
})

store.$subscribe(() => {
  exec()
})

const exec = () => {
  average.value = store.average
  passRate.value = store.passRate
  excellentRate.value = store.excellentRate
  optimumRate.value = store.optimumRate
  lowScoreRate.value = store.lowScoreRate
  comprehensiveRatingRate.value = store.comprehensiveRatingRate
}

exec()
</script>

<template>
  <el-card class="statistics-rate__wrapper">
    <div class="card-header">
      <div class="card-title">
        <font-awesome-icon :icon="['solid', 'chart-simple']" />
        <span>成绩统计</span>
      </div>
      <download-btn />
    </div>
    <div class="stats-grid">
      <div class="stat-item highlight">
        <div class="stat-value">{{ outputAverage.toFixed(1) }}</div>
        <div class="stat-label">平均分</div>
      </div>
      <div class="stat-item">
        <div class="stat-value">{{ outputComprehensiveRatingRate.toFixed(1) }}%</div>
        <div class="stat-label">
          综合比率
          <el-tooltip
            effect="dark"
            content="平均分*40% + 及格率*30% + 优秀率*30% + 特优率*5% - 低分率*5%"
            placement="top"
          >
            <font-awesome-icon :icon="['solid', 'circle-question']" class="hint-icon" />
          </el-tooltip>
        </div>
      </div>
    </div>
    <el-divider />
    <el-row :gutter="16">
      <el-col :span="6">
        <div class="stat-mini">
          <div class="stat-mini-value success">{{ outputPassRate.toFixed(1) }}%</div>
          <div class="stat-mini-label">及格率</div>
        </div>
      </el-col>
      <el-col :span="6">
        <div class="stat-mini">
          <div class="stat-mini-value primary">{{ outputExcellentRate.toFixed(1) }}%</div>
          <div class="stat-mini-label">优秀率</div>
        </div>
      </el-col>
      <el-col :span="6">
        <div class="stat-mini">
          <div class="stat-mini-value gold">{{ outputOptimumRate.toFixed(1) }}%</div>
          <div class="stat-mini-label">特优率</div>
        </div>
      </el-col>
      <el-col :span="6">
        <div class="stat-mini">
          <div class="stat-mini-value danger">{{ outputLowScoreRate.toFixed(1) }}%</div>
          <div class="stat-mini-label">低分率</div>
        </div>
      </el-col>
    </el-row>
  </el-card>
</template>

<style scoped lang="scss">
.statistics-rate__wrapper {
  border-radius: 10px;
  height: 100%;

  .card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 12px;

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

  .stats-grid {
    display: flex;
    gap: 12px;
    margin-bottom: 12px;

    .stat-item {
      flex: 1;
      text-align: center;
      padding: 14px;
      background: #f8fafc;
      border-radius: 8px;

      &.highlight {
        background: linear-gradient(
          135deg,
          var(--theme-primary) 0%,
          var(--theme-primary-light) 100%
        );
        color: #fff;

        .stat-label {
          color: rgba(255, 255, 255, 0.85);
        }
      }

      .stat-value {
        font-size: 26px;
        font-weight: bold;
        color: #1e293b;
      }

      .stat-label {
        font-size: 12px;
        color: #64748b;
        margin-top: 4px;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 4px;

        .hint-icon {
          font-size: 11px;
          color: #94a3b8;
          cursor: pointer;
        }
      }
    }
  }

  :deep(.el-divider) {
    margin: 10px 0;
  }

  .stat-mini {
    text-align: center;

    .stat-mini-value {
      font-size: 18px;
      font-weight: bold;

      &.success {
        color: #22c55e;
      }

      &.primary {
        color: var(--theme-primary);
      }

      &.gold {
        color: #f59e0b;
      }

      &.danger {
        color: #ef4444;
      }
    }

    .stat-mini-label {
      font-size: 11px;
      color: #64748b;
      margin-top: 2px;
    }
  }
}
</style>
