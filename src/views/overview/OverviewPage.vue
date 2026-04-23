<script setup lang="ts">
import { nextTick, ref } from 'vue'
import { useRouter } from 'vue-router'

import PageHeader from '@/components/PageHeader.vue'

import HomeAlertPanel from '@/views/overview/components/HomeAlertPanel.vue'
import HomeRankingPanel from '@/views/overview/components/HomeRankingPanel.vue'
import HomeStudentTrendPanel from '@/views/overview/components/HomeStudentTrendPanel.vue'
import HomeUnitOverviewChart from '@/views/overview/components/HomeUnitOverviewChart.vue'

import { useHomeDashboard } from '@/hooks/useHomeDashboard'

const { selectedStudentNames, dashboardData, focusStudent } = useHomeDashboard()
const router = useRouter()
const trendDrawerVisible = ref(false)
const alertDrawerVisible = ref(false)
const rankingDrawerVisible = ref(false)

const openStudentTrend = (name?: string) => {
  if (name) {
    focusStudent(name)
  }

  alertDrawerVisible.value = false
  rankingDrawerVisible.value = false
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
</script>

<template>
  <div class="home-page app-page-shell">
    <page-header
      :icon="['solid', 'chart-line']"
      title="班级总览"
    >
      <template #right>
        <button class="header-action-pill" @click="openStudentTrend()">
          <font-awesome-icon :icon="['solid', 'chart-simple']" />
          <span>学生趋势分析</span>
        </button>
      </template>
    </page-header>

    <div class="home-dashboard">
      <div class="dashboard-primary">
        <home-unit-overview-chart :unit-overview="dashboardData.unitOverview" />
      </div>

      <div class="dashboard-side">
        <el-card class="dashboard-workbench">
          <div class="workbench-header">
            <div class="workbench-title">快捷工作台</div>
          </div>

          <div class="workbench-metrics">
            <button class="metric-card is-warning" @click="router.push('/comment')">
              <span class="metric-label">待写评语</span>
              <strong>{{ dashboardData.evaluationOverview.pendingCount }}</strong>
              <span class="metric-unit">人</span>
            </button>
            <button class="metric-card" @click="goToAiSetting">
              <span class="metric-label">AI 配置</span>
              <strong>{{ dashboardData.evaluationOverview.aiConfigured ? '已配置' : '未配置' }}</strong>
            </button>
          </div>
        </el-card>

        <home-alert-panel
          class="dashboard-alert"
          :groups="dashboardData.alertGroups"
          variant="compact"
          @select="openStudentTrend"
        />
      </div>

      <home-ranking-panel
        class="dashboard-ranking"
        :groups="dashboardData.rankingGroups"
        variant="compact"
        @select="openStudentTrend"
      />
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

    <el-drawer
      v-model="alertDrawerVisible"
      class="overview-list-drawer"
      size="760px"
      title="重点学生预警"
      append-to-body
    >
      <home-alert-panel :groups="dashboardData.alertGroups" variant="full" @select="openStudentTrend" />
    </el-drawer>

    <el-drawer
      v-model="rankingDrawerVisible"
      class="overview-list-drawer"
      size="760px"
      title="学生掌握情况榜单"
      append-to-body
    >
      <home-ranking-panel :groups="dashboardData.rankingGroups" variant="full" @select="openStudentTrend" />
    </el-drawer>
  </div>
</template>

<style scoped lang="scss">
.home-page {
  min-height: 0;
}

.home-dashboard {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(0, 1.85fr) minmax(360px, 1fr);
  grid-template-rows: minmax(430px, 1fr) auto;
  grid-template-areas:
    'primary side'
    'ranking side';
  gap: 12px;
}

.dashboard-primary {
  grid-area: primary;
  min-height: 0;

  :deep(.unit-overview-card) {
    height: 100%;
    min-height: 430px;
  }

  :deep(.unit-overview-card .el-card__body) {
    height: 100%;
  }
}

.dashboard-side {
  grid-area: side;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
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

.dashboard-workbench {
  flex: 0 0 auto;
  border-radius: 14px;
  border: 1px solid var(--border-muted);
  box-shadow: var(--shadow-card);

  :deep(.el-card__body) {
    display: flex;
    flex-direction: column;
    gap: 6px;
    box-sizing: border-box;
    padding: 8px 10px;
  }
}

.workbench-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.workbench-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
}

.workbench-metrics {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px;
}

.metric-card {
  min-width: 0;
  min-height: 48px;
  padding: 7px 8px;
  border: 1px solid #e5edf5;
  border-radius: 12px;
  background: #f8fafc;
  text-align: center;
  cursor: pointer;
  transition:
    transform 0.2s ease,
    border-color 0.2s ease,
    background-color 0.2s ease;

  &:hover {
    transform: translateY(-1px);
    border-color: color-mix(in srgb, var(--theme-primary) 28%, #ffffff);
    background: color-mix(in srgb, var(--theme-primary) 6%, #ffffff);
  }

  .metric-label {
    display: block;
    font-size: 11px;
    color: var(--text-secondary);
  }

  strong {
    display: inline-block;
    margin-top: 3px;
    font-size: 16px;
    line-height: 1;
    color: var(--text-primary);
  }

  .metric-unit {
    margin-left: 4px;
    font-size: 12px;
    color: var(--text-secondary);
  }
}

.is-warning strong {
  color: #d97706;
}

.dashboard-alert {
  flex: 1;
  min-height: 0;
}

.dashboard-ranking {
  grid-area: ranking;
  min-height: 0;
}

@media (max-width: 1280px) {
  .home-dashboard {
    grid-template-columns: 1fr;
    grid-template-rows: auto;
    grid-template-areas:
      'primary'
      'side'
      'ranking';
  }

  .dashboard-side {
    min-height: auto;
  }
}

:global(.overview-analysis-drawer .el-drawer__body),
:global(.overview-list-drawer .el-drawer__body) {
  background: #f8fafc;
}

.drawer-trend-panel {
  min-height: 100%;
}

:global(.overview-list-drawer) {
  max-width: 86vw;
}
</style>
