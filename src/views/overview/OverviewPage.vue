<script setup lang="ts">
import { nextTick, ref } from 'vue'
import { useRouter } from 'vue-router'

import PageHeader from '@/components/PageHeader.vue'

import HomeDiagnosisCard from '@/views/overview/components/HomeDiagnosisCard.vue'
import HomeFocusCenter from '@/views/overview/components/HomeFocusCenter.vue'
import HomeKeyStudentLists from '@/views/overview/components/HomeKeyStudentLists.vue'
import HomeKpiStrip from '@/views/overview/components/HomeKpiStrip.vue'
import HomeStudentTrendPanel from '@/views/overview/components/HomeStudentTrendPanel.vue'
import HomeUnitOverviewChart from '@/views/overview/components/HomeUnitOverviewChart.vue'

import { useOverviewAnalysis } from '@/views/overview/composables/useOverviewAnalysis'
import { useOverviewDashboard } from '@/views/overview/composables/useOverviewDashboard'

/**
 * 页面层仅负责页面编排、路由和抽屉开关。
 * 业务数据和 AI 逻辑全部下沉到 composable，减少页面脚本负担。
 */
const { selectedStudentNames, dashboardData, focusStudent } = useOverviewDashboard()
const router = useRouter()
const trendDrawerVisible = ref(false)
const {
  analysisText: learningAnalysisText,
  generatedAt: learningAnalysisGeneratedAt,
  loading: learningAnalysisLoading,
  generateAnalysis
} = useOverviewAnalysis(dashboardData)

const openStudentTrend = (name?: string) => {
  if (name) {
    focusStudent(name)
  }

  trendDrawerVisible.value = true
}

const goToAiSetting = () => {
  router.push({
    path: '/setting',
    query: {
      tab: 'ai-config'
    }
  })
}

const goToEvaluationFromTrend = async () => {
  trendDrawerVisible.value = false
  await nextTick()
  router.push('/comment')
}

const handleGenerateLearningAnalysis = async () => {
  if (!dashboardData.value.evaluationOverview.aiConfigured) {
    goToAiSetting()
    return
  }

  await generateAnalysis()
}
</script>

<template>
  <div class="home-page app-page-shell">
    <page-header :icon="['solid', 'chart-line']" title="班级总览">
      <template #right>
        <div class="header-actions">
          <button class="header-action-pill" @click="openStudentTrend()">
            <font-awesome-icon :icon="['solid', 'chart-simple']" />
            <span>学生趋势分析</span>
          </button>
          <button class="header-action-pill is-light is-warning" @click="router.push('/comment')">
            <font-awesome-icon :icon="['solid', 'pen-to-square']" />
            <span>待写评语 {{ dashboardData.evaluationOverview.pendingCount }} 人</span>
          </button>
          <button class="header-action-pill is-light" @click="goToAiSetting">
            <font-awesome-icon :icon="['solid', 'wand-magic-sparkles']" />
            <span>AI {{ dashboardData.evaluationOverview.aiConfigured ? '已配置' : '未配置' }}</span>
          </button>
        </div>
      </template>
    </page-header>

    <div class="home-dashboard">
      <div class="dashboard-left">
        <home-kpi-strip class="dashboard-kpi" :summary-cards="dashboardData.summaryCards" />

        <div class="dashboard-primary-stack">
          <div class="dashboard-primary">
            <home-unit-overview-chart
              :unit-overview="dashboardData.unitOverview"
              :teaching-insights="dashboardData.teachingInsights"
            />
          </div>

          <home-key-student-lists
            class="dashboard-key-lists"
            :lists="dashboardData.keyStudentLists"
            @select="openStudentTrend"
          />
        </div>
      </div>

      <div class="dashboard-right">
        <home-diagnosis-card
          class="dashboard-diagnosis"
          :evaluation-overview="dashboardData.evaluationOverview"
          :analysis-text="learningAnalysisText"
          :analysis-generated-at="learningAnalysisGeneratedAt"
          :analysis-loading="learningAnalysisLoading"
          @generate-analysis="handleGenerateLearningAnalysis"
          @go-ai-setting="goToAiSetting"
        />

        <div class="dashboard-side">
          <home-focus-center
            :focus-groups="dashboardData.focusGroups"
            :completed-unit-count="dashboardData.kpi.completedUnitCount"
            @select="openStudentTrend"
          />
        </div>
      </div>
    </div>

    <el-drawer
      v-model="trendDrawerVisible"
      class="overview-analysis-drawer"
      size="72%"
      title="学生趋势分析"
      append-to-body
    >
      <home-student-trend-panel
        class="drawer-trend-panel"
        v-model="selectedStudentNames"
        :student-trend="dashboardData.studentTrend"
        :student-options="dashboardData.studentOptions"
        :quick-student-names="dashboardData.quickStudentNames"
        @go-evaluation="goToEvaluationFromTrend"
      />
    </el-drawer>
  </div>
</template>

<style scoped lang="scss">
.home-page {
  height: 100%;
  min-height: 0;
  overflow: hidden;
}

.home-dashboard {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(0, 7fr) minmax(340px, 3fr);
  gap: 12px;
  overflow: hidden;
}

.dashboard-left,
.dashboard-right {
  flex: 1;
  min-height: 0;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  overflow: hidden;
}

.dashboard-left {
  gap: 8px;
}

.dashboard-right {
  gap: 12px;
  min-height: 0;
  overflow: hidden;
}

.dashboard-kpi {
  flex-shrink: 0;
}

.dashboard-primary-stack {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
  overflow: hidden;
}

.dashboard-primary {
  flex: 0 0 400px;
  min-height: 0;
  overflow: hidden;

  :deep(.unit-overview-card) {
    height: 100%;
    min-height: 400px;
  }
}

.dashboard-side {
  min-height: 0;
  flex: 1;
  overflow: hidden;
}

.dashboard-diagnosis {
  flex-shrink: 0;
}

.dashboard-key-lists {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.header-actions {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.header-action-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 28px;
  padding: 0 12px;
  border: 1px solid var(--theme-primary);
  border-radius: 999px;
  background: var(--theme-primary);
  color: #ffffff;
  font-size: 12px;
  font-weight: 600;
  line-height: 1;
  cursor: pointer;
  transition:
    background-color 0.2s ease,
    border-color 0.2s ease,
    transform 0.2s ease;

  &:hover {
    transform: translateY(-1px);
    border-color: color-mix(in srgb, var(--theme-primary) 86%, #000000);
    background: color-mix(in srgb, var(--theme-primary) 90%, #000000);
  }

  svg {
    font-size: 11px;
  }
}

.header-action-pill.is-light {
  border-color: #e5edf5;
  background: #ffffff;
  color: var(--text-primary);

  &:hover {
    border-color: color-mix(in srgb, var(--theme-primary) 28%, #ffffff);
    background: color-mix(in srgb, var(--theme-primary) 6%, #ffffff);
  }
}

.header-action-pill.is-warning {
  color: #d97706;
}

@media (max-width: 1280px) {
  .home-dashboard {
    grid-template-columns: 1fr;
    overflow: auto;
  }

  .dashboard-side {
    height: auto;
    min-height: 520px;
  }

  .dashboard-primary {
    flex-basis: 400px;
  }

  .home-page {
    overflow: auto;
  }
}

:global(.overview-analysis-drawer .el-drawer__body) {
  background: #f8fafc;
}

.drawer-trend-panel {
  min-height: 100%;
}
</style>
