<script setup lang="ts">
import { computed } from 'vue'

import gradeLaurelUrl from '@/assets/score-notice/grade-laurel-neutral-2x.png'
import gradeRibbonBlueUrl from '@/assets/score-notice/grade-ribbon-blue-2x.png'
import gradeRibbonGoldUrl from '@/assets/score-notice/grade-ribbon-gold-2x.png'
import gradeRibbonGreenUrl from '@/assets/score-notice/grade-ribbon-green-2x.png'
import gradeRibbonOliveUrl from '@/assets/score-notice/grade-ribbon-olive-2x.png'
import gradeRibbonOrangeUrl from '@/assets/score-notice/grade-ribbon-orange-2x.png'
import gradeRibbonPurpleUrl from '@/assets/score-notice/grade-ribbon-purple-2x.png'
import gradeRibbonRoseUrl from '@/assets/score-notice/grade-ribbon-rose-2x.png'
import gradeRibbonTealUrl from '@/assets/score-notice/grade-ribbon-teal-2x.png'
import ornamentStarUrl from '@/assets/score-notice/ornament-star-2x.png'
import subjectCardCornerUrl from '@/assets/score-notice/subject-card-corner-2x.png'
import { ScoreNoticeModeEnum } from '@/types/ScoreNotice'
import { formatScoreValue } from '@/utils/score-notice/scoreNoticeGradeUtil'

import type { ScoreNoticeStudentType, ScoreNoticeSubjectType } from '@/types/ScoreNotice'

const props = defineProps<{
  mode: ScoreNoticeModeEnum
  subjects: ScoreNoticeSubjectType[]
  student: ScoreNoticeStudentType
}>()

/** 依据科目数量计算每行列数 */
const columnCount = computed(() => {
  if (props.subjects.length <= 5) return Math.max(props.subjects.length, 1)
  if (props.subjects.length <= 10) return 5
  return 6
})

/** 依据科目数量选择标准/紧凑/密集布局 */
const subjectLayout = computed(() => {
  if (props.subjects.length <= 5) return 'standard'
  if (props.subjects.length <= 10) return 'compact'
  return 'dense'
})

/** 计算科目卡片宽度并注入 CSS 变量 */
const subjectGridStyle = computed(() => {
  const columns = columnCount.value
  const gap = subjectLayout.value === 'standard' ? 22 : subjectLayout.value === 'compact' ? 14 : 10
  const cardWidth = `calc((100% - ${(columns - 1) * gap}px) / ${columns})`
  return { '--subject-card-width': cardWidth }
})

const gradeRibbonUrls = [
  gradeRibbonGreenUrl,
  gradeRibbonBlueUrl,
  gradeRibbonOrangeUrl,
  gradeRibbonPurpleUrl,
  gradeRibbonGoldUrl,
  gradeRibbonTealUrl,
  gradeRibbonRoseUrl,
  gradeRibbonOliveUrl
]

/**
 * 获取科目展示值：分数模式取原始分数，等级模式取等级。
 * @param subject 科目
 * @returns 展示字符串
 */
const getDisplayValue = (subject: ScoreNoticeSubjectType): string => {
  if (!props.student) return '--'
  if (props.mode === ScoreNoticeModeEnum.Score) {
    return formatScoreValue(props.student.rawValues[subject.id])
  }
  return props.student.gradeValues[subject.id] || '--'
}

/** 依据分数位数返回字号缩放类名 */
const getScoreLengthClass = (subject: ScoreNoticeSubjectType): string => {
  if (props.mode !== ScoreNoticeModeEnum.Score) return ''
  const length = getDisplayValue(subject).length
  if (length === 3) return 'score-report__grade-medal--score-length-3'
  if (length >= 4) return 'score-report__grade-medal--score-length-4'
  return ''
}

/** 依据索引循环取用彩带图片 */
const getGradeRibbonUrl = (index: number): string => gradeRibbonUrls[index % gradeRibbonUrls.length]

/** 将等级转换为中文评语描述 */
const getGradeCaption = (subject: ScoreNoticeSubjectType): string => {
  const grade = props.student?.gradeValues[subject.id]
  if (grade === 'A') return '表现优秀'
  if (grade === 'B') return '表现良好'
  if (grade === 'C') return '继续努力'
  return '暂无数据'
}

/** 依据科目名称匹配对应的图标 */
const getSubjectIcon = (label: string): string => {
  if (label.includes('语文')) return 'book-open'
  if (label.includes('数学')) return 'calculator'
  if (label.includes('英语')) return 'language'
  if (label.includes('科学')) return 'flask'
  if (label.includes('体育')) return 'person-running'
  if (label.includes('美术')) return 'palette'
  if (label.includes('音乐')) return 'music'
  if (label.includes('道法') || label.includes('道德')) return 'scale-balanced'
  return 'star'
}
</script>

<template>
  <section class="score-report__subject-section">
    <div class="score-report__subject-grid" :style="subjectGridStyle">
      <div
        v-for="(subject, index) in subjects"
        :key="subject.id"
        class="score-report__subject"
        :class="`score-report__subject--tone-${(index % 8) + 1}`"
      >
        <img
          v-for="position in ['top-left', 'top-right', 'bottom-left', 'bottom-right']"
          :key="`${subject.id}-${position}`"
          class="score-report__subject-corner"
          :class="`score-report__subject-corner--${position}`"
          :src="subjectCardCornerUrl"
          alt=""
          aria-hidden="true"
        />
        <div class="score-report__subject-name">
          <font-awesome-icon :icon="['solid', getSubjectIcon(subject.label)]" />
          <span>{{ subject.label }}</span>
        </div>
        <div class="score-report__subject-separator"><i></i><b>◆</b><i></i></div>
        <div class="score-report__grade-medal" :class="getScoreLengthClass(subject)">
          <img class="score-report__grade-wreath" :src="gradeLaurelUrl" alt="" aria-hidden="true" />
          <div class="score-report__grade-ring">
            <span :class="{ 'score-report__score-value': mode === ScoreNoticeModeEnum.Score }">
              {{ getDisplayValue(subject) }}
            </span>
            <img :src="ornamentStarUrl" alt="" aria-hidden="true" />
          </div>
          <img
            class="score-report__grade-ribbon"
            :src="getGradeRibbonUrl(index)"
            alt=""
            aria-hidden="true"
          />
        </div>
        <div class="score-report__grade-caption">{{ getGradeCaption(subject) }}</div>
      </div>
    </div>
  </section>
</template>

<style scoped lang="scss">
.score-report__subject-grid {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 22px;
}
.score-report__subject {
  position: relative;
  flex: 0 0 var(--subject-card-width);
  min-width: 0;
  min-height: 292px;
  padding: 24px 12px 18px;
  box-sizing: border-box;
  text-align: center;
  background: linear-gradient(145deg, rgba(255, 255, 255, 0.76), rgba(248, 235, 202, 0.56));
  border: 1px solid rgba(181, 130, 48, 0.7);
  box-shadow:
    0 7px 13px rgba(81, 53, 18, 0.16),
    0 2px 3px rgba(81, 53, 18, 0.12),
    inset 0 1px 0 rgba(255, 255, 255, 0.9),
    inset 0 -2px 4px rgba(158, 112, 38, 0.08);
}
.score-report__subject-corner {
  position: absolute;
  width: 34px;
  height: 34px;
}
.score-report__subject-corner--top-left {
  top: -2px;
  left: -2px;
}
.score-report__subject-corner--top-right {
  top: -2px;
  right: -2px;
  transform: scaleX(-1);
}
.score-report__subject-corner--bottom-left {
  bottom: -2px;
  left: -2px;
  transform: scaleY(-1);
}
.score-report__subject-corner--bottom-right {
  right: -2px;
  bottom: -2px;
  transform: scale(-1);
}
.score-report__subject-name {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 9px;
  min-height: 38px;
  color: var(--subject-tone);
  font-size: 25px;
  font-weight: 700;
}
.score-report__subject-separator {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  margin: 4px 28px 0;
  color: var(--subject-tone);
  font-size: 8px;
}
.score-report__subject-separator i {
  flex: 1;
  border-top: 1px dotted color-mix(in srgb, var(--subject-tone) 48%, transparent);
}
.score-report__grade-medal {
  position: relative;
  width: 170px;
  height: 168px;
  margin: 2px auto -1px;
}
.score-report__grade-wreath {
  position: absolute;
  inset: 4px 5px 6px;
  z-index: 1;
  width: 160px;
  height: 160px;
  object-fit: contain;
}
.score-report__grade-ring {
  position: absolute;
  top: 31px;
  left: 42px;
  z-index: 3;
  width: 86px;
  height: 86px;
  color: var(--subject-tone);
  background: rgba(255, 251, 238, 0.8);
  border: 4px double color-mix(in srgb, var(--subject-tone) 75%, #d4ad5c);
  border-radius: 50%;
  box-shadow: inset 0 0 0 2px rgba(255, 255, 255, 0.7);
}
.score-report__grade-ring span {
  position: absolute;
  right: 0;
  bottom: 22px;
  left: 0;
  font-family: Georgia, serif;
  font-size: 55px;
  font-weight: 700;
  line-height: 0.9;
  text-align: center;
}
.score-report__grade-ring img {
  position: absolute;
  bottom: 5px;
  left: 50%;
  width: 15px;
  height: 15px;
  margin: 0;
  transform: translateX(-50%);
}
.score-report__grade-ring .score-report__score-value {
  display: block;
  font-family: 'Times New Roman', Georgia, serif;
  font-size: 45px;
  letter-spacing: -1px;
  white-space: nowrap;
}
.score-report__grade-medal--score-length-3 .score-report__score-value {
  font-size: 45px;
}
.score-report__grade-medal--score-length-4 .score-report__score-value {
  font-size: 40px;
}
.score-report__grade-ribbon {
  position: absolute;
  right: 15px;
  bottom: 3px;
  left: 15px;
  z-index: 2;
  height: 53px;
  object-fit: contain;
  filter: drop-shadow(0 2px 1px rgba(77, 48, 12, 0.24));
}
.score-report__grade-caption {
  color: #313b39;
  font-size: 22px;
}
.score-report__subject--tone-1 {
  --subject-tone: #176541;
}
.score-report__subject--tone-2 {
  --subject-tone: #285f9d;
}
.score-report__subject--tone-3 {
  --subject-tone: #b9562d;
}
.score-report__subject--tone-4 {
  --subject-tone: #71439a;
}
.score-report__subject--tone-5 {
  --subject-tone: #ad7818;
}
.score-report__subject--tone-6 {
  --subject-tone: #16768a;
}
.score-report__subject--tone-7 {
  --subject-tone: #944a68;
}
.score-report__subject--tone-8 {
  --subject-tone: #58723e;
}
:global(.score-report--subjects-compact .score-report__subject-grid) {
  gap: 14px;
}
:global(.score-report--subjects-compact .score-report__subject) {
  min-height: 178px;
  padding: 14px 7px 10px;
}
:global(.score-report--subjects-compact .score-report__subject-name) {
  min-height: 28px;
  gap: 6px;
  font-size: 19px;
}
:global(.score-report--subjects-compact .score-report__subject-separator) {
  margin: 1px 18px 0;
}
:global(.score-report--subjects-compact .score-report__grade-medal) {
  width: 118px;
  height: 114px;
  margin: 0 auto -2px;
}
:global(.score-report--subjects-compact .score-report__grade-wreath) {
  inset: 3px 4px 4px;
  width: 110px;
  height: 110px;
}
:global(.score-report--subjects-compact .score-report__grade-ring) {
  top: 23px;
  left: 30px;
  width: 56px;
  height: 56px;
  border-width: 3px;
}
:global(.score-report--subjects-compact .score-report__grade-ring span) {
  bottom: 10px;
  font-size: 37px;
}
:global(.score-report--subjects-compact .score-report__grade-ring img) {
  bottom: 1px;
  width: 10px;
  height: 10px;
}
:global(.score-report--subjects-compact .score-report__grade-ring .score-report__score-value) {
  font-size: 30px;
  letter-spacing: -0.5px;
}
:global(
  .score-report--subjects-compact
    .score-report__grade-medal--score-length-4
    .score-report__score-value
) {
  font-size: 27px;
  letter-spacing: -0.5px;
}
:global(.score-report--subjects-compact .score-report__grade-ribbon) {
  right: 9px;
  bottom: 0;
  left: 9px;
  height: 36px;
}
:global(.score-report--subjects-compact .score-report__grade-caption) {
  font-size: 17px;
}
:global(.score-report--subjects-dense .score-report__subject-grid) {
  gap: 10px;
}
:global(.score-report--subjects-dense .score-report__subject) {
  min-height: 128px;
  padding: 9px 4px 6px;
}
:global(.score-report--subjects-dense .score-report__subject-corner) {
  width: 25px;
  height: 25px;
}
:global(.score-report--subjects-dense .score-report__subject-name) {
  min-height: 22px;
  gap: 4px;
  font-size: 16px;
}
:global(.score-report--subjects-dense .score-report__subject-separator) {
  display: none;
}
:global(.score-report--subjects-dense .score-report__grade-medal) {
  width: 88px;
  height: 82px;
  margin: 0 auto -2px;
}
:global(.score-report--subjects-dense .score-report__grade-wreath) {
  inset: 2px 3px 3px;
  width: 82px;
  height: 82px;
}
:global(.score-report--subjects-dense .score-report__grade-ring) {
  top: 17px;
  left: 23px;
  width: 39px;
  height: 39px;
  border-width: 2px;
}
:global(.score-report--subjects-dense .score-report__grade-ring span) {
  bottom: 2px;
  font-size: 28px;
}
:global(.score-report--subjects-dense .score-report__grade-ring img) {
  display: none;
}
:global(.score-report--subjects-dense .score-report__grade-ring .score-report__score-value) {
  font-size: 23px;
  letter-spacing: -0.4px;
}
:global(
  .score-report--subjects-dense
    .score-report__grade-medal--score-length-4
    .score-report__score-value
) {
  font-size: 19px;
  letter-spacing: -0.4px;
}
:global(.score-report--subjects-dense .score-report__grade-ribbon) {
  right: 6px;
  bottom: 0;
  left: 6px;
  height: 26px;
}
:global(.score-report--subjects-dense .score-report__grade-caption) {
  font-size: 14px;
}
</style>
