<script setup lang="ts">
import { computed } from 'vue'
import type { EChartsOption, LineSeriesOption } from 'echarts'

import AppEChart from '@/components/AppEChart.vue'
import studentReportReferenceStamp from '@/assets/student-report/reference-stamp.png'
import type { StudentReportDataType } from '@/utils/studentReportUntil'

interface Props {
  report: StudentReportDataType
  content: string
}

const props = defineProps<Props>()

const articleParagraphs = computed(() => {
  return props.content
    .split('\n\n')
    .map((item) => item.trim())
    .filter(Boolean)
})

const formatAverageLegendName = (label: string, value: number): string => `${label}（${value.toFixed(1)}分）`

const getStudentAverageDisplayScore = (classAverageScore: number, studentAverageScore: number): number => {
  if (Math.abs(classAverageScore - studentAverageScore) >= 1) return studentAverageScore
  if (studentAverageScore >= classAverageScore) {
    return studentAverageScore <= 99.75 ? studentAverageScore + 0.25 : studentAverageScore - 0.25
  }

  return studentAverageScore >= 0.25 ? studentAverageScore - 0.25 : studentAverageScore + 0.25
}

const getTooltipScoreText = (seriesName: string, value: unknown): string => {
  const averageScoreText = seriesName.match(/（([^）]+分)）$/)?.[1]
  if (averageScoreText) return averageScoreText
  return typeof value === 'number' ? `${value} 分` : ''
}

const chartOption = computed<EChartsOption>(() => {
  const items = props.report.scoreItems
  if (!items.length) {
    return {}
  }

  const referenceScores = [props.report.classAverageScore, props.report.summary.averageScore]
  const scoreRangeValues = [...items.map((item) => item.score), ...referenceScores]
  const maxScore = Math.max(...scoreRangeValues, 100)
  const minScore = Math.min(...scoreRangeValues, 40)
  const ceiling = Math.ceil(maxScore / 10) * 10
  const floor = Math.max(Math.floor(minScore / 10) * 10 - 10, 0)
  const start = Math.max(floor, 0)
  const end = Math.max(ceiling, start + 20)
  const xAxisLabels = items.map((item) => item.label)
  const studentAverageDisplayScore = getStudentAverageDisplayScore(
    props.report.classAverageScore,
    props.report.summary.averageScore
  )
  const referenceSeries: LineSeriesOption[] = [
    {
      name: formatAverageLegendName('班级整体均分', props.report.classAverageScore),
      type: 'line',
      smooth: false,
      symbol: 'none',
      lineStyle: {
        color: '#7c3aed',
        type: 'dashed',
        width: 2
      },
      itemStyle: {
        color: '#7c3aed'
      },
      label: {
        show: false
      },
      emphasis: {
        disabled: true
      },
      data: xAxisLabels.map(() => props.report.classAverageScore),
      z: 1
    },
    {
      name: formatAverageLegendName('个人平均分', props.report.summary.averageScore),
      type: 'line',
      smooth: false,
      symbol: 'none',
      lineStyle: {
        color: '#dc2626',
        type: 'solid',
        width: 1.8,
        opacity: 0.88
      },
      itemStyle: {
        color: '#dc2626'
      },
      label: {
        show: false
      },
      emphasis: {
        disabled: true
      },
      data: xAxisLabels.map(() => studentAverageDisplayScore),
      z: 1
    }
  ]

  return {
    animationDuration: 700,
    animationEasing: 'cubicOut',
    grid: {
      left: 10,
      right: 12,
      top: 42,
      bottom: 22,
      containLabel: true
    },
    legend: {
      top: 0,
      itemWidth: 12,
      itemHeight: 8,
      textStyle: {
        color: '#6e6358',
        fontSize: 12
      }
    },
    tooltip: {
      trigger: 'axis',
      confine: true,
      padding: [10, 12],
      borderWidth: 1,
      borderColor: '#eadbc7',
      backgroundColor: 'rgba(255, 252, 246, 0.98)',
      textStyle: {
        color: '#40352c'
      },
      axisPointer: {
        type: 'line',
        lineStyle: {
          color: '#9bbfc0',
          type: 'dashed'
        }
      },
      formatter: (params: unknown) => {
        const rows = Array.isArray(params)
          ? (params as Array<{ axisValueLabel?: string; marker?: string; seriesName?: string; value?: unknown }>)
          : []
        const title = rows[0]?.axisValueLabel || ''
        const content = rows
          .filter((item) => item.value !== null && item.value !== undefined && item.value !== '')
          .map((item) => {
            const seriesName = item.seriesName || ''
            const tooltipName = seriesName.replace(/（[^）]+分）$/, '')
            const scoreText = getTooltipScoreText(seriesName, item.value)

            return `<div style="display:flex;align-items:center;justify-content:space-between;gap:16px;margin-top:6px;">
              <span>${item.marker || ''}${tooltipName}</span>
              <strong>${scoreText}</strong>
            </div>`
          })
          .join('')

        return `<div style="min-width:120px;">
          <div style="font-weight:600;margin-bottom:2px;">${title}</div>
          ${content}
        </div>`
      }
    },
    xAxis: {
      type: 'category',
      data: xAxisLabels,
      axisTick: { show: false },
      axisLine: {
        lineStyle: {
          color: '#d8cbbb'
        }
      },
      axisLabel: {
        color: '#4f4237',
        fontSize: 12,
        margin: 12
      }
    },
    yAxis: {
      type: 'value',
      min: start,
      max: end,
      interval: Math.max(Math.round((end - start) / 4 / 10) * 10, 10),
      axisLine: {
        show: false
      },
      axisTick: {
        show: false
      },
      axisLabel: {
        color: '#6e6358',
        fontSize: 12
      },
      splitLine: {
        lineStyle: {
          color: '#e7ddcf',
          type: 'dashed'
        }
      }
    },
    series: [
      {
        name: '成绩',
        type: 'line',
        smooth: true,
        symbol: 'circle',
        symbolSize: 8,
        showSymbol: true,
        lineStyle: {
          width: 3,
          color: '#0f8a87'
        },
        itemStyle: {
          color: '#0f8a87',
          borderColor: '#ffffff',
          borderWidth: 2
        },
        label: {
          show: true,
          position: 'top',
          color: '#3a3128',
          fontSize: 12,
          fontWeight: 700
        },
        areaStyle: {
          color: 'rgba(15, 138, 135, 0.08)'
        },
        data: items.map((item) => item.score)
      },
      ...referenceSeries
    ]
  }
})
</script>

<template>
  <article class="student-report-card">
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

      <div class="student-report-card__hero-meta">
        生成时间：{{ report.generatedAtText }}
      </div>
    </header>

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
            <span class="student-report-card__score">{{ item.score }}</span>
            <span>{{ item.rank }} / {{ report.studentCount }}</span>
            <span :class="item.score >= item.average ? 'student-report-card__delta-up' : 'student-report-card__delta-down'">
              {{ item.score >= item.average ? '高于' : '低于' }} {{ Math.abs(item.score - item.average).toFixed(1) }} 分
            </span>
            <span :class="item.delta !== null && item.delta > 0 ? 'student-report-card__delta-up' : item.delta !== null && item.delta < 0 ? 'student-report-card__delta-down' : ''">
              {{ item.delta === null ? '—' : `${item.delta > 0 ? '↑' : item.delta < 0 ? '↓' : ''} ${Math.abs(item.delta)} 分` }}
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

    <section class="student-report-card__section">
      <div class="student-report-card__section-heading">
        <span class="student-report-card__heading-icon student-report-card__heading-icon--teal">
          <font-awesome-icon :icon="['solid', 'chart-line']" />
        </span>
        <h2 class="student-report-card__section-title">成绩趋势分析</h2>
      </div>

      <div class="student-report-card__chart">
        <AppEChart height="188px" :option="chartOption" />
      </div>
    </section>

    <section class="student-report-card__bottom-grid">
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
              :class="item.title === '优势表现' ? 'student-report-card__insight-badge--green' : 'student-report-card__insight-badge--red'"
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

    <footer class="student-report-card__footnote">
      本报告根据学生阶段成绩数据整理生成，内容仅作为学习情况参考，不作为唯一评价依据。
    </footer>
  </article>
</template>

<style scoped lang="scss">
.student-report-card {
  width: 1120px;
  padding: 32px;
  color: #31261d;
  background:
    radial-gradient(circle at top right, rgba(35, 120, 130, 0.08), transparent 18%),
    radial-gradient(circle at bottom left, rgba(224, 120, 58, 0.08), transparent 20%),
    linear-gradient(180deg, #fcf7ee 0%, #f6eddd 100%);
  border: 1px solid rgba(210, 191, 162, 0.8);
  border-radius: 24px;
  box-shadow:
    0 24px 70px rgba(126, 99, 57, 0.16),
    inset 0 1px 0 rgba(255, 255, 255, 0.68);
}

.student-report-card__hero,
.student-report-card__section,
.student-report-card__stat-card {
  background: rgba(255, 248, 236, 0.82);
  border: 1px solid rgba(224, 205, 175, 0.7);
  box-shadow: 0 10px 24px rgba(129, 97, 56, 0.08);
}

.student-report-card__hero {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 24px;
  padding: 18px 22px;
  border-radius: 18px;
  background: transparent;
  border: 0;
  box-shadow: none;
}

.student-report-card__hero-left {
  display: flex;
  align-items: center;
  gap: 24px;
  min-width: 0;
}

.student-report-card__stamp {
  flex: 0 0 auto;
  width: 132px;
  height: 132px;
  object-fit: contain;
}

.student-report-card__hero-copy {
  min-width: 0;
  padding-top: 8px;
}

.student-report-card__title {
  margin: 0;
  color: #5a3a17;
  font-size: 44px;
  line-height: 1.1;
  letter-spacing: 2px;
  font-weight: 800;
  text-shadow: 0 2px 0 rgba(255, 255, 255, 0.55);
}

.student-report-card__lead {
  margin: 18px 0 0;
  color: #4e4237;
  font-size: 14px;
  line-height: 1.85;
}

.student-report-card__hero-meta {
  padding-top: 8px;
  color: #6e6358;
  font-size: 12px;
  white-space: nowrap;
}

.student-report-card__section {
  margin-top: 14px;
  padding: 16px;
  border-radius: 16px;
  background: rgba(255, 251, 245, 0.86);
  box-shadow: 0 12px 28px rgba(129, 97, 56, 0.08);
}

.student-report-card__section--scoreboard {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 428px;
  gap: 18px;
}

.student-report-card__section-heading {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
}

.student-report-card__heading-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 8px;
  font-size: 14px;
}

.student-report-card__heading-icon--teal {
  color: #0f766e;
  background: rgba(15, 118, 110, 0.12);
}

.student-report-card__heading-icon--green {
  color: #2f855a;
  background: rgba(47, 133, 90, 0.12);
}

.student-report-card__heading-icon--gold {
  color: #b7791f;
  background: rgba(183, 121, 31, 0.14);
}

.student-report-card__section-title {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
}

.student-report-card__table {
  overflow: hidden;
  border: 1px solid rgba(232, 220, 203, 0.9);
  border-radius: 12px;
}

.student-report-card__table-row {
  display: grid;
  grid-template-columns: 1.4fr 0.78fr 0.8fr 1fr 0.92fr;
  gap: 10px;
  align-items: center;
  min-height: 46px;
  padding: 0 18px;
  border-top: 1px solid rgba(239, 228, 214, 0.94);
  font-size: 13px;
}

.student-report-card__table-row--head {
  color: #6c655e;
  background: rgba(250, 247, 241, 0.92);
  border-top: 0;
  font-size: 12px;
  font-weight: 600;
}

.student-report-card__score {
  color: #d83b2f;
  font-size: 16px;
  font-weight: 700;
}

.student-report-card__delta-up {
  color: #18794e;
}

.student-report-card__delta-down {
  color: #dc2626;
}

.student-report-card__stat-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.student-report-card__stat-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 16px;
  border-radius: 14px;
  text-align: center;
}

.student-report-card__stat-card--teal {
  background: linear-gradient(180deg, #f7fcf8 0%, #f1f8f2 100%);
}

.student-report-card__stat-card--blue {
  background: linear-gradient(180deg, #f7faff 0%, #f1f5fd 100%);
}

.student-report-card__stat-card--orange {
  background: linear-gradient(180deg, #fff9f4 0%, #fdf3eb 100%);
}

.student-report-card__stat-card--purple {
  background: linear-gradient(180deg, #fbf8ff 0%, #f5effe 100%);
}

.student-report-card__stat-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 38px;
  height: 38px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.85);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.9);
}

.student-report-card__stat-card--teal .student-report-card__stat-icon {
  color: #69a864;
}

.student-report-card__stat-card--blue .student-report-card__stat-icon {
  color: #7fa7eb;
}

.student-report-card__stat-card--orange .student-report-card__stat-icon {
  color: #f19a87;
}

.student-report-card__stat-card--purple .student-report-card__stat-icon {
  color: #9f82d9;
}

.student-report-card__stat-label {
  margin-top: 12px;
  color: #466155;
  font-size: 13px;
  font-weight: 700;
}

.student-report-card__stat-value {
  margin-top: 8px;
  color: #2f2a26;
  font-size: 19px;
  font-weight: 700;
  line-height: 1.2;
}

.student-report-card__stat-hint {
  margin-top: 8px;
  color: #665b52;
  font-size: 12px;
  line-height: 1.7;
}

.student-report-card__chart {
  padding-top: 2px;
  min-height: 188px;
}

.student-report-card__bottom-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.55fr) minmax(340px, 1fr);
  gap: 14px;
}

.student-report-card__article p {
  margin: 0;
  color: #41362d;
  font-size: 14px;
  line-height: 2;
  text-indent: 2em;
}

.student-report-card__article p + p {
  margin-top: 8px;
}

.student-report-card__insight-group {
  display: grid;
  gap: 12px;
}

.student-report-card__insight-badge {
  display: inline-flex;
  align-items: center;
  padding: 3px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;
}

.student-report-card__insight-badge--green {
  color: #2f855a;
  background: rgba(47, 133, 90, 0.12);
}

.student-report-card__insight-badge--red {
  color: #dc2626;
  background: rgba(220, 38, 38, 0.1);
}

.student-report-card__insight-list {
  margin: 10px 0 0;
  padding-left: 18px;
  color: #40352c;
  font-size: 14px;
  line-height: 1.85;
}

.student-report-card__footnote {
  margin-top: 12px;
  color: #756a60;
  font-size: 12px;
  text-align: center;
}
</style>
