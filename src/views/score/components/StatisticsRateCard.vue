<script setup lang="ts">
/**
 * 成绩总览卡片
 * 展示平均分、综合比率、及格率等指标，并通过过渡动画平滑更新。
 */
import { computed, ref, watch } from 'vue'
import { useTransition } from '@vueuse/core'

import { storeToRefs } from 'pinia'

import { useDataSourceStore } from '@/stores/data-source'
import { useConfigurationStore } from '@/stores/configuration'

const store = useDataSourceStore()
const configuration = useConfigurationStore()
const { enabledData: tableData } = storeToRefs(store)

const hasData = computed(() => store.hasAnyScore)
const validCount = computed(() => store.validCount)
const totalCount = computed(() => store.totalCount)
const maxScore = computed(() => {
  const scores = store.validScores
  if (!scores.length) return 0
  return Math.max(...scores)
})
/** 当前科目最低分，无数据时为 0 */
const minScore = computed(() => {
  const scores = store.validScores
  if (!scores.length) return 0
  return Math.min(...scores)
})

const comprehensiveRatingRate = ref(0)
const average = ref(0)
const passRate = ref(0)
const excellentRate = ref(0)
const optimumRate = ref(0)
const lowScoreRate = ref(0)

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

/** 从 store 同步最新统计指标到本地响应式状态 */
const exec = () => {
  average.value = store.average
  passRate.value = store.passRate
  excellentRate.value = store.excellentRate
  optimumRate.value = store.optimumRate
  lowScoreRate.value = store.lowScoreRate
  comprehensiveRatingRate.value = store.comprehensiveRatingRate
}

watch(
  () => [tableData.value, configuration.inputScoreTab],
  // 表格数据或当前科目变化时重新计算统计指标
  () => exec(),
  {
    immediate: true,
    deep: true
  }
)
</script>

<template>
  <el-card class="statistics-rate__wrapper">
    <div class="card-header">
      <div class="card-title">
        <font-awesome-icon :icon="['solid', 'chart-simple']" />
        <span>成绩总览</span>
      </div>
    </div>

    <template v-if="hasData">
      <div class="stats-grid">
        <div class="stat-item">
          <div class="stat-label">平均分</div>
          <div class="stat-value">{{ outputAverage.toFixed(2) }}</div>
        </div>
        <div class="stat-item">
          <div class="stat-label with-tip">
            综合比率
            <el-tooltip
              effect="dark"
              content="平均分×40% + 及格率(%)×30% + 优秀率(%)×30% + 特优率(%)×5% - 低分率(%)×5%"
              placement="top"
            >
              <font-awesome-icon :icon="['solid', 'circle-question']" class="hint-icon" />
            </el-tooltip>
          </div>
          <div class="stat-value">{{ outputComprehensiveRatingRate.toFixed(2) }}%</div>
        </div>
        <div class="stat-item">
          <div class="stat-label">及格率</div>
          <div class="stat-value">{{ outputPassRate.toFixed(2) }}%</div>
        </div>
      </div>
      <div class="meta-line">
        优秀率 {{ outputExcellentRate.toFixed(2) }}% | 特优率 {{ outputOptimumRate.toFixed(2) }}% |
        低分率 {{ outputLowScoreRate.toFixed(2) }}%
      </div>
      <div class="extreme-row">最高 {{ maxScore }} 分 | 最低 {{ minScore }} 分</div>
    </template>

    <div v-else class="empty-hint">
      <font-awesome-icon :icon="['solid', 'chart-simple']" />
      <span>暂无成绩数据</span>
      <span class="empty-sub">已录入 {{ validCount }} / {{ totalCount }} 人</span>
    </div>
  </el-card>
</template>

<style scoped lang="scss">
.statistics-rate__wrapper {
  border-radius: 12px;
  opacity: 0.92;
  background: #fff;
  border: 1px solid var(--border-muted);
  box-shadow: var(--shadow-card);

  :deep(.el-card__body) {
    background: #fff;
  }

  .card-header {
    display: flex;
    align-items: center;
    margin-bottom: 10px;

    .card-title {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 13px;
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
    gap: 8px;
    margin-bottom: 8px;

    .stat-item {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      padding: 8px 10px;
      background: #f1f5f9;
      border-radius: 8px;
      min-height: 68px;

      .stat-value {
        font-size: 16px;
        font-weight: 700;
        color: #1e293b;
      }

      .stat-label {
        font-size: 11px;
        color: #64748b;
        margin-bottom: 2px;
      }

      .with-tip {
        display: inline-flex;
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

  .meta-line {
    font-size: 11px;
    color: #64748b;
  }

  .extreme-row {
    margin-top: 6px;
    font-size: 11px;
    color: #475569;
  }

  .empty-hint {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 28px 0;
    color: #94a3b8;

    svg {
      font-size: 30px;
      margin-bottom: 10px;
      color: var(--theme-primary);
      opacity: 0.5;
    }

    span {
      font-size: 13px;
    }

    .empty-sub {
      font-size: 11px;
      margin-top: 6px;
      color: #64748b;
    }
  }
}
</style>
