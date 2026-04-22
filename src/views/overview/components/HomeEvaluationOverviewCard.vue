<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'

import type { DashboardEvaluationOverviewType } from '@/types/HomeDashboard'

interface Props {
  overview: DashboardEvaluationOverviewType
}

const props = defineProps<Props>()
const router = useRouter()

const completionLabel = computed(() => {
  return `${props.overview.completedCount} / ${props.overview.totalCount}`
})

/**
 * 评语总览弱化成轻量状态块：
 * 点击块本身完成跳转，不再额外占用按钮空间
 */
const handleCardClick = (target: 'comment' | 'setting') => {
  if (target === 'comment') {
    router.push('/comment')
    return
  }

  router.push({
    path: '/setting',
    query: {
      tab: 'ai-config'
    }
  })
}
</script>

<template>
  <el-card class="home-side-card evaluation-overview-card">
    <div class="panel-header">
      <div class="panel-title">评语工作总览</div>
      <div class="panel-subtitle">保持轻量，只看完成情况和 AI 配置状态</div>
    </div>

    <div class="overview-grid">
      <button class="overview-item is-clickable" @click="handleCardClick('comment')">
        <div class="item-label">未写评语</div>
        <div class="item-value">{{ overview.pendingCount }}</div>
        <div class="item-sub">待处理</div>
      </button>
      <button class="overview-item is-clickable" @click="handleCardClick('comment')">
        <div class="item-label">完成率</div>
        <div class="item-value">{{ overview.completionRate }}%</div>
        <div class="item-sub">{{ completionLabel }}</div>
      </button>
      <button class="overview-item is-clickable" @click="handleCardClick('setting')">
        <div class="item-label">AI 配置</div>
        <div class="item-value">{{ overview.aiConfigured ? '已配置' : '未配置' }}</div>
        <div class="item-sub">点击前往</div>
      </button>
    </div>
  </el-card>
</template>

<style scoped lang="scss">
.home-side-card {
  border-radius: 14px;
  border: 1px solid var(--border-muted);
  box-shadow: var(--shadow-card);

  :deep(.el-card__body) {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
}

.evaluation-overview-card {
  :deep(.el-card__body) {
    padding: 12px;
  }
}

.panel-header {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.panel-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
}

.panel-subtitle {
  font-size: 12px;
  color: var(--text-secondary);
}

.overview-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 6px;
}

.overview-item {
  width: 100%;
  padding: 10px;
  border-radius: 10px;
  background: #f8fafc;
  border: 1px solid #e5edf5;
  text-align: left;
}

.is-clickable {
  cursor: pointer;
  transition:
    border-color 0.2s ease,
    background-color 0.2s ease,
    transform 0.2s ease;

  &:hover {
    border-color: color-mix(in srgb, var(--theme-primary) 28%, #ffffff);
    background: color-mix(in srgb, var(--theme-primary) 6%, #ffffff);
    transform: translateY(-1px);
  }
}

.item-label {
  font-size: 11px;
  color: var(--text-secondary);
}

.item-value {
  margin-top: 4px;
  font-size: 16px;
  font-weight: 700;
  color: var(--text-primary);
  line-height: 1.2;
}

.item-sub {
  margin-top: 2px;
  font-size: 11px;
  color: #94a3b8;
}
</style>
