<script setup lang="ts">
import type { ExamPrintAnalysisType } from '@/types/ExamPrint'
defineProps<{ analysis: ExamPrintAnalysisType }>()
const value = (number: number | null, percent = false): string =>
  number === null ? '—' : `${number.toFixed(1)}${percent ? '%' : ''}`
</script>
<template>
  <section class="exam-summary">
    <div class="exam-summary__stats">
      <p>
        满分：{{ analysis.fullMark }} 在班人数：{{ analysis.total }} 有效成绩：{{
          analysis.valid
        }}
        无有效成绩：{{ analysis.missing }}
      </p>
      <p>
        平均分：{{ value(analysis.average) }} 及格率：{{
          value(analysis.passRate, true)
        }}
        优秀率：{{ value(analysis.excellentRate, true) }}
      </p>
      <small>及格线为满分的 60%，优秀线为满分的 80%；分母为有效成绩人数。</small>
    </div>
    <h2>分数分布（按满分比例）</h2>
    <div v-for="band in analysis.bands" :key="band.label" class="exam-summary__band">
      <span>{{ band.label }}</span>
      <div class="exam-summary__track">
        <div :style="{ width: `${analysis.valid ? (band.count / analysis.valid) * 100 : 0}%` }" />
      </div>
      <span>{{ band.count }} 人</span>
    </div>
    <h2 class="exam-summary__notes">教学调整 / 备注</h2>
    <div v-for="line in 4" :key="line" class="exam-summary__line" />
    <small>无有效成绩不等同于缺考；本页仅包含当前测评，不含历史参照。</small>
  </section>
</template>
<style scoped lang="scss">
p {
  margin: 0 0 24px;
  font-size: 23px;
}
small {
  font-size: 18px;
}
h2 {
  font-size: 27px;
  margin: 60px 0 30px;
}
.exam-summary__band {
  display: grid;
  grid-template-columns: 310px 1fr 100px;
  align-items: center;
  gap: 24px;
  height: 102px;
}
.exam-summary__band > span:last-child {
  text-align: right;
}
.exam-summary__track {
  height: 48px;
}
.exam-summary__track > div {
  height: 100%;
  background: #d7e6e2;
}
.exam-summary__notes {
  margin-top: 66px;
}
.exam-summary__line {
  height: 72px;
  border-bottom: 1px solid #aaa;
}
.exam-summary > small {
  display: block;
  margin-top: 42px;
}
</style>
