<script setup lang="ts">
/**
 * 成绩分析视图
 * 根据页面阶段展示空状态或统计卡片组合。
 */
import { computed } from 'vue'

import EmptyStatePanel from '@/components/EmptyStatePanel.vue'
import DownloadBtn from '@/views/score/components/DownloadBtn.vue'
import StatisticsRateCard from '@/views/score/components/StatisticsRateCard.vue'
import StatisticsNumCard from '@/views/score/components/StatisticsNumCard.vue'
import LowScoreCard from '@/views/score/components/LowScoreCard.vue'
import type { ScorePageStageType } from '@/types/Score'

interface Props {
  canExport?: boolean
  stage: ScorePageStageType
}

const props = withDefaults(defineProps<Props>(), {
  canExport: false
})

/** 依据阶段生成对应的空状态提示 */
const emptyState = computed(() => {
  if (props.stage === 'noUnits') {
    return {
      icon: 'table-columns',
      title: '暂无成绩统计',
      description: '设置单元并录入成绩后，将显示均分、及格率、分数段和低分名单。'
    }
  }

  return {
    icon: 'chart-simple',
    title: '当前单元暂无成绩',
    description: '录入任意一名学生成绩后，将开始生成统计。'
  }
})
</script>

<template>
  <div class="score-analysis-view__wrapper">
    <div class="analysis-header">
      <div class="title">成绩统计</div>
      <download-btn :disabled="!canExport" />
    </div>

    <empty-state-panel
      v-if="stage !== 'ready'"
      :icon="emptyState.icon"
      :title="emptyState.title"
      :description="emptyState.description"
      description-max-width="260px"
    />

    <el-scrollbar v-else>
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
