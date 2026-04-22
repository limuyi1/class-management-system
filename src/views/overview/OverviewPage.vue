<script setup lang="ts">
import PageHeader from '@/components/PageHeader.vue'

import HomeAlertPanel from '@/views/overview/components/HomeAlertPanel.vue'
import HomeEvaluationOverviewCard from '@/views/overview/components/HomeEvaluationOverviewCard.vue'
import HomeRankingPanel from '@/views/overview/components/HomeRankingPanel.vue'
import HomeStudentTrendCard from '@/views/overview/components/HomeStudentTrendCard.vue'
import HomeUnitOverviewChart from '@/views/overview/components/HomeUnitOverviewChart.vue'

import { useHomeDashboard } from '@/hooks/useHomeDashboard'

const { selectedStudentNames, dashboardData, selectStudent } = useHomeDashboard()
</script>

<template>
  <div class="home-page app-page-shell">
    <page-header
      :icon="['solid', 'chart-line']"
      title="班级总览"
      subtitle="先看整班单元走势，再定位重点学生，并衔接到个人趋势与评语处理"
    >
      <template #right>
        <el-tag effect="plain" round>单元 {{ dashboardData.unitOverview.length }}</el-tag>
        <el-tag effect="plain" round type="warning">
          未写评语 {{ dashboardData.evaluationOverview.pendingCount }} 人
        </el-tag>
      </template>
    </page-header>

    <div class="home-dashboard">
      <el-scrollbar class="dashboard-scroll">
        <div class="dashboard-main">
          <home-unit-overview-chart :unit-overview="dashboardData.unitOverview" />
          <home-student-trend-card
            v-model="selectedStudentNames"
            :student-trend="dashboardData.studentTrend"
            :student-options="dashboardData.studentOptions"
            :quick-student-names="dashboardData.quickStudentNames"
          />
        </div>
      </el-scrollbar>

      <el-scrollbar class="dashboard-scroll">
        <div class="dashboard-side">
          <home-alert-panel :groups="dashboardData.alertGroups" @select="selectStudent" />
          <home-ranking-panel :groups="dashboardData.rankingGroups" @select="selectStudent" />
          <home-evaluation-overview-card :overview="dashboardData.evaluationOverview" />
        </div>
      </el-scrollbar>
    </div>
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
  grid-template-columns: minmax(0, 1.8fr) minmax(320px, 1fr);
  gap: 12px;
}

.dashboard-scroll {
  min-height: 0;

  :deep(.el-scrollbar__wrap) {
    min-height: 0;
  }
}

.dashboard-main {
  display: grid;
  grid-template-rows: minmax(420px, auto) minmax(520px, auto);
  gap: 12px;
  padding-right: 6px;
}

.dashboard-side {
  display: grid;
  grid-template-rows: auto auto auto;
  gap: 12px;
  align-content: start;
  padding-right: 6px;
}

@media (max-width: 1280px) {
  .home-dashboard {
    grid-template-columns: 1fr;
  }

  .dashboard-main {
    grid-template-rows: minmax(420px, auto) minmax(520px, auto);
  }
}
</style>
