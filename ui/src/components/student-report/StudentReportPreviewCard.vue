<script setup lang="ts">
import { computed } from 'vue'

import AppEChart from '@/components/AppEChart.vue'
import studentReportReferenceStamp from '@/assets/student-report/reference-stamp.png'
import { buildStudentReportChartOptions } from '@/utils/studentReportChartUtil'

import type { StudentReportDataType } from '@/utils/studentReportUtil'

/**
 * 学习报告预览卡片。
 *
 * 以纸质报告样式展示学生阶段成绩、成绩趋势图表、综合评语与优势/关注点，
 * 图表配置（含班级均分与个人均分参考线）在此组件内组装。
 */
interface Props {
  /** 批量导出时关闭图表动画，确保截图包含完整趋势线 */
  staticRendering?: boolean
  /** 学习报告数据 */
  report: StudentReportDataType
  /** 报告正文内容 */
  content: string
}

const props = defineProps<Props>()

// 正文按空行拆分为段落，去掉空白段落
const articleParagraphs = computed(() => {
  return props.content
    .split('\n\n')
    .map((item) => item.trim())
    .filter(Boolean)
})

const chartOption = computed(() => ({
  ...buildStudentReportChartOptions(props.report),
  ...(props.staticRendering ? { animation: false } : {})
}))
</script>

<template>
  <article class="student-report-card">
    <!-- 报告头部：印章、标题与生成时间 -->
    <header class="student-report-card__hero">
      <div class="student-report-card__hero-left">
        <img
          class="student-report-card__stamp"
          :src="studentReportReferenceStamp"
          alt="仅供参考印章"
        />

        <div class="student-report-card__hero-copy">
          <h1 class="student-report-card__title">{{ report.headline }}</h1>
          <p class="student-report-card__lead">{{ report.overviewLead }}</p>
        </div>
      </div>

      <div class="student-report-card__hero-meta">生成时间：{{ report.generatedAtText }}</div>
    </header>

    <!-- 阶段成绩回顾：成绩表格与统计卡片 -->
    <section class="student-report-card__section student-report-card__section--scoreboard">
      <div class="student-report-card__scoreboard-main">
        <div class="student-report-card__section-heading">
          <span class="student-report-card__heading-icon student-report-card__heading-icon--teal">
            <font-awesome-icon :icon="['regular', 'file-lines']" />
          </span>
          <h2 class="student-report-card__section-title">阶段成绩回顾</h2>
        </div>

        <div class="student-report-card__table">
          <div class="student-report-card__table-row student-report-card__table-row--head">
            <span>阶段名称</span>
            <span>成绩（分）</span>
            <span>班级名次</span>
            <span>高于/低于班均</span>
            <span>较上次变化</span>
          </div>

          <div
            v-for="item in report.scoreItems"
            :key="item.prop"
            class="student-report-card__table-row"
          >
            <span>{{ item.label }}</span>
            <span class="student-report-card__score">{{
              item.score === null ? '—' : item.score
            }}</span>
            <span>{{
              item.rank === null ? '—' : `${item.rank} / ${item.rankCount ?? report.studentCount}`
            }}</span>
            <span
              :class="
                item.score !== null && item.average !== null
                  ? item.score >= item.average
                    ? 'student-report-card__delta-up'
                    : 'student-report-card__delta-down'
                  : ''
              "
            >
              {{
                item.score === null || item.average === null
                  ? '—'
                  : `${item.score >= item.average ? '高于' : '低于'} ${Math.abs(item.score - item.average).toFixed(1)} 分`
              }}
            </span>
            <span
              :class="
                item.delta !== null && item.delta > 0
                  ? 'student-report-card__delta-up'
                  : item.delta !== null && item.delta < 0
                    ? 'student-report-card__delta-down'
                    : ''
              "
            >
              {{
                item.delta === null
                  ? '—'
                  : `${item.delta > 0 ? '↑' : item.delta < 0 ? '↓' : ''} ${Math.abs(item.delta)} 分`
              }}
            </span>
          </div>
        </div>
      </div>

      <div class="student-report-card__stat-grid">
        <div
          v-for="item in report.summary.statCards"
          :key="item.label"
          class="student-report-card__stat-card"
          :class="`student-report-card__stat-card--${item.tone}`"
        >
          <div class="student-report-card__stat-icon">
            <font-awesome-icon :icon="['solid', item.icon]" />
          </div>
          <div class="student-report-card__stat-label">{{ item.label }}</div>
          <div class="student-report-card__stat-value">{{ item.value }}</div>
          <div class="student-report-card__stat-hint">{{ item.hint }}</div>
        </div>
      </div>
    </section>

    <!-- 成绩趋势分析图表 -->
    <section class="student-report-card__section">
      <div class="student-report-card__section-heading">
        <span class="student-report-card__heading-icon student-report-card__heading-icon--teal">
          <font-awesome-icon :icon="['solid', 'chart-line']" />
        </span>
        <h2 class="student-report-card__section-title">成绩趋势分析</h2>
      </div>

      <div class="student-report-card__chart">
        <AppEChart renderer="svg" height="188px" :option="chartOption" />
      </div>
    </section>

    <section class="student-report-card__bottom-grid">
      <!-- 综合表现总结 -->
      <section class="student-report-card__section">
        <div class="student-report-card__section-heading">
          <span class="student-report-card__heading-icon student-report-card__heading-icon--green">
            <font-awesome-icon :icon="['regular', 'bookmark']" />
          </span>
          <h2 class="student-report-card__section-title">综合表现总结</h2>
        </div>

        <div class="student-report-card__article">
          <p v-for="(paragraph, index) in articleParagraphs" :key="index">
            {{ paragraph }}
          </p>
        </div>
      </section>

      <!-- 优势与关注点 -->
      <section class="student-report-card__section">
        <div class="student-report-card__section-heading">
          <span class="student-report-card__heading-icon student-report-card__heading-icon--gold">
            <font-awesome-icon :icon="['solid', 'star']" />
          </span>
          <h2 class="student-report-card__section-title">优势与关注点</h2>
        </div>

        <div class="student-report-card__insight-group">
          <div v-for="item in report.insights" :key="item.title">
            <div
              class="student-report-card__insight-badge"
              :class="
                item.title === '优势表现'
                  ? 'student-report-card__insight-badge--green'
                  : 'student-report-card__insight-badge--red'
              "
            >
              {{ item.title }}
            </div>
            <ul class="student-report-card__insight-list">
              <li v-for="text in item.items" :key="text">
                {{ text }}
              </li>
            </ul>
          </div>
        </div>
      </section>
    </section>

    <!-- 报告脚注声明 -->
    <footer class="student-report-card__footnote">
      本报告根据学生阶段成绩数据整理生成，内容仅作为学习情况参考，不作为唯一评价依据。
    </footer>
  </article>
</template>

<style scoped lang="scss" src="./styles/student-report-preview.scss"></style>
