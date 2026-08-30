<script setup lang="ts">
/**
 * 分数分布统计卡片
 * 展示最高/最低/平均分摘要、分数段分布与低分面板，并支持复制分布文本。
 */
import { computed } from 'vue'
import { storeToRefs } from 'pinia'

import { useDataSourceStore } from '@/stores/data-source'
import { useConfigurationStore } from '@/stores/configuration'
import { useSettingStore } from '@/stores/setting'
import { useScoreStatistics } from '@/hooks/useScoreStatistics'
import { useScoreDistributionActions } from '@/hooks/useScoreDistributionActions'

import ScoreSummary from '@/views/score/components/statistics/ScoreSummary.vue'
import ScoreRangeList from '@/views/score/components/statistics/ScoreRangeList.vue'
import LowScorePanel from '@/views/score/components/statistics/LowScorePanel.vue'

// 学生数据、应用配置与表头设置 store
const store = useDataSourceStore()
const configuration = useConfigurationStore()
const settingStore = useSettingStore()

// 全部学生与启用的成绩科目列
const { students: originList } = storeToRefs(store)
const { enabledScoreColumns: scoreColumns } = storeToRefs(settingStore)

// 当前录入科目 prop，作为统计的分数来源
const scorePropRef = computed(() => configuration.inputScoreTab)
/** 当前统计标题，无科目时回退为“成绩分布统计” */
const scoreTitle = computed(() => {
  const scoreProp = configuration.inputScoreTab
  if (!scoreProp) return '成绩分布统计'
  return scoreColumns.value.find((header) => header.prop === scoreProp)?.label || scoreProp
})

// 分数统计、低分名单、阈值与分数读取函数
const { scoreStats, belowThresholdStudents, threshold, getScore } = useScoreStatistics({
  students: computed(() => originList.value),
  scoreProp: scorePropRef
})

// 复制分数分布文本的能力
const { copyToClipboard } = useScoreDistributionActions({
  scoreStats,
  belowThresholdStudents,
  threshold,
  title: scoreTitle,
  getScore
})

/** 触发复制分数分布文本 */
const copyDistribution = () => {
  copyToClipboard()
}
</script>

<template>
  <el-card class="statistics-card__wrapper">
    <!-- 卡片头部：标题与复制按钮 -->
    <div class="card-header">
      <div class="card-title">
        <font-awesome-icon :icon="['solid', 'chart-column']" />
        <span>分数分布</span>
      </div>
      <div class="card-actions">
        <el-button v-if="scoreStats" type="primary" size="small" round @click="copyDistribution">
          <template #icon><font-awesome-icon :icon="['solid', 'copy']" /></template>
          复制
        </el-button>
      </div>
    </div>

    <!-- 有成绩时展示摘要、分数段与低分面板 -->
    <template v-if="scoreStats">
      <score-summary :score-stats="scoreStats" />
      <score-range-list :score-stats="scoreStats" />
      <low-score-panel :score-stats="scoreStats" />
    </template>

    <!-- 无成绩时展示空提示 -->
    <div v-else class="empty-hint">
      <font-awesome-icon :icon="['solid', 'chart-simple']" />
      <span>暂无成绩数据</span>
    </div>
  </el-card>
</template>

<style scoped lang="scss">
.statistics-card__wrapper {
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
        color: var(--theme-primary);
        font-size: 16px;
      }
    }

    .card-actions {
      display: flex;
      gap: 2px;
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
