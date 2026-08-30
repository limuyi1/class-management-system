<script setup lang="ts">
/** KPI 汇总条 — 展示四类关注分组卡片与班级概况卡片，未就绪时渲染待分析占位 */
import { computed } from 'vue'

import OverviewSummaryCard from '@/views/overview/components/kpi/OverviewSummaryCard.vue'
import OverviewSummaryOverviewCard from '@/views/overview/components/kpi/OverviewSummaryOverviewCard.vue'

import type {
  DashboardEvaluationOverviewType,
  DashboardSummaryCardType,
  OverviewDashboardStageType
} from '@/types/HomeDashboard'

interface Props {
  /** 汇总卡片数据，包含四类分组卡片 + 班级概况卡片 */
  summaryCards: DashboardSummaryCardType[]
  /** 总览页当前数据阶段，用于区分真实统计和待分析空态 */
  stage: OverviewDashboardStageType
  /** 当前有效学生人数 */
  studentCount: number
  /** 已设置的成绩单元数 */
  unitCount: number
  /** 评语完成情况 */
  evaluationOverview: DashboardEvaluationOverviewType
}

const props = defineProps<Props>()

/**
 * 未就绪阶段的占位卡片数据。
 * 当页面尚未进入 ready 阶段时，用统一的“待分析”卡片提示用户下一步动作。
 */
const pendingSummaryCards = computed<DashboardSummaryCardType[]>(() => {
  const hasUnits = props.stage !== 'noUnits'
  const scoreHint = hasUnits ? '录入成绩后开始分析' : '添加单元后开始分析'

  return [
    {
      key: 'attention',
      label: '立即关注',
      value: '待分析',
      icon: 'circle-exclamation',
      layout: 'quad',
      tone: 'danger',
      summary: '录入成绩后识别低分、下滑和异常学生',
      details: [
        { label: '临界风险', value: scoreHint },
        { label: '持续低分', value: scoreHint }
      ]
    },
    {
      key: 'encouragement',
      label: '值得鼓励',
      value: '待分析',
      icon: 'thumbs-up',
      layout: 'double',
      tone: 'success',
      summary: '录入多次成绩后识别进步和稳定表现',
      details: [
        { label: '进步回升', value: scoreHint },
        { label: '高分稳定', value: scoreHint }
      ]
    },
    {
      key: 'middleChange',
      label: '中段变化',
      value: '待分析',
      icon: 'chart-line',
      layout: 'triple',
      tone: 'info',
      summary: '需要至少 2-3 次成绩形成变化判断',
      details: [
        { label: '中段上升', value: scoreHint },
        { label: '中段下滑', value: scoreHint }
      ]
    },
    {
      key: 'volatilityWatch',
      label: '波动观察',
      value: '待分析',
      icon: 'wave-square',
      layout: 'double',
      tone: 'warning',
      summary: '需要多个单元成绩后分析波动趋势',
      details: [
        { label: '波动上行', value: scoreHint },
        { label: '波动下行', value: scoreHint }
      ]
    },
    {
      key: 'overview',
      label: '班级概况',
      value: props.studentCount,
      unit: '人',
      icon: 'clock',
      layout: 'overview',
      tone: 'warning',
      summary: '班级已建立，可继续完善单元、成绩和评语',
      details: [
        { label: '学生人数', value: `${props.studentCount} 人` },
        {
          label: '评语完成',
          value: `${props.evaluationOverview.completedCount}/${props.studentCount}`
        },
        { label: '已设置单元', value: `${props.unitCount} 个` }
      ]
    }
  ]
})

/** 根据阶段选择展示真实汇总卡片或待分析占位卡片 */
const displayedSummaryCards = computed(() =>
  props.stage === 'ready' ? props.summaryCards : pendingSummaryCards.value
)

/** 统计类卡片：立即关注、值得鼓励、中段变化、波动观察（不含班级概况） */
const statCards = computed(() =>
  displayedSummaryCards.value.filter((card) => card.key !== 'overview')
)
/** 班级概况卡片，单独展示 */
const overviewCard = computed(
  () => displayedSummaryCards.value.find((card) => card.key === 'overview') || null
)

/**
 * 根据卡片类型返回 grid 列跨度。
 * attention 和 overview 占 2 列，其他卡片占 1 列。
 * 响应式布局下统一为 1 列。
 */
const getCardSpan = (card: DashboardSummaryCardType) => {
  switch (card.key) {
    case 'attention':
      return 2
    case 'overview':
      return 2
    default:
      return 1
  }
}
</script>

<template>
  <section class="home-kpi-strip">
    <div class="summary-grid">
      <!-- 统计类卡片：立即关注、值得鼓励、中段变化、波动观察 -->
      <overview-summary-card
        v-for="card in statCards"
        :key="card.key"
        :card="card"
        :span="getCardSpan(card)"
      />

      <!-- 班级概况卡片，单独渲染 -->
      <overview-summary-overview-card
        v-if="overviewCard"
        :card="overviewCard"
        :span="getCardSpan(overviewCard)"
      />
    </div>
  </section>
</template>

<style scoped lang="scss">
.home-kpi-strip {
  display: block;
  width: 100%;
  min-width: 0;
  box-sizing: border-box;
}

.summary-grid {
  width: 100%;
  min-width: 0;
  box-sizing: border-box;
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 12px;
}

@media (max-width: 1440px) {
  .summary-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .summary-card,
  .summary-card.summary-card--overview {
    grid-column: span 1 !important;
  }
}

@media (max-width: 1280px) {
  .summary-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 768px) {
  .summary-grid {
    grid-template-columns: 1fr;
  }
}
</style>
