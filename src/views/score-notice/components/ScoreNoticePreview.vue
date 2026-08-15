<script setup lang="ts">
import { computed, ref } from 'vue'

import commentBoxCornerUrl from '@/assets/score-notice/comment-box-corner-2x.png'
import gradeLaurelUrl from '@/assets/score-notice/grade-laurel-neutral-2x.png'
import gradeRibbonBlueUrl from '@/assets/score-notice/grade-ribbon-blue-2x.png'
import gradeRibbonGoldUrl from '@/assets/score-notice/grade-ribbon-gold-2x.png'
import gradeRibbonGreenUrl from '@/assets/score-notice/grade-ribbon-green-2x.png'
import gradeRibbonOliveUrl from '@/assets/score-notice/grade-ribbon-olive-2x.png'
import gradeRibbonOrangeUrl from '@/assets/score-notice/grade-ribbon-orange-2x.png'
import gradeRibbonPurpleUrl from '@/assets/score-notice/grade-ribbon-purple-2x.png'
import gradeRibbonRoseUrl from '@/assets/score-notice/grade-ribbon-rose-2x.png'
import gradeRibbonTealUrl from '@/assets/score-notice/grade-ribbon-teal-2x.png'
import logoUrl from '@/assets/score-notice/logo-transparent.png'
import ornamentLaurelUrl from '@/assets/score-notice/ornament-laurel-2x.png'
import ornamentStarUrl from '@/assets/score-notice/ornament-star-2x.png'
import paperFloralWatermarkUrl from '@/assets/score-notice/paper-floral-watermark-2x.png'
import reportCornerUrl from '@/assets/score-notice/report-corner-ornament-2x.png'
import reportPaperUrl from '@/assets/score-notice/report-paper-background.png'
import subjectCardCornerUrl from '@/assets/score-notice/subject-card-corner-2x.png'
import teacherCommentBadgeUrl from '@/assets/score-notice/teacher-comment-badge-2x.png'
import { ScoreNoticeModeEnum } from '@/types/ScoreNotice'
import { formatScoreValue } from '@/utils/score-notice/scoreNoticeGradeUtil'

import type { ScoreNoticeStudentType, ScoreNoticeSubjectType } from '@/types/ScoreNotice'

interface Props {
  title: string
  noticeDate: string
  mode: ScoreNoticeModeEnum
  subjects: ScoreNoticeSubjectType[]
  student: ScoreNoticeStudentType | null
}

const props = defineProps<Props>()
const reportElement = ref<HTMLElement | null>(null)

const columnCount = computed(() => {
  if (props.subjects.length <= 5) return Math.max(props.subjects.length, 1)
  if (props.subjects.length <= 10) return 5
  return 6
})
const subjectLayout = computed(() => {
  if (props.subjects.length <= 5) return 'standard'
  if (props.subjects.length <= 10) return 'compact'
  return 'dense'
})
const subjectGridStyle = computed(() => {
  const columns = columnCount.value
  const gap = subjectLayout.value === 'standard' ? 22 : subjectLayout.value === 'compact' ? 14 : 10
  const cardWidth = `calc((100% - ${(columns - 1) * gap}px) / ${columns})`
  return { '--subject-card-width': cardWidth }
})
const commentLength = computed(() => (props.student?.comment || '').replace(/\s/g, '').length)
const titleLengthClass = computed(() => {
  const length = (props.title || '考试成绩通知').replace(/\s/g, '').length
  if (length > 16) return 'score-report__title--long'
  if (length > 10) return 'score-report__title--medium'
  return ''
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

const getDisplayValue = (subject: ScoreNoticeSubjectType): string => {
  if (!props.student) return '--'
  if (props.mode === ScoreNoticeModeEnum.Score) {
    return formatScoreValue(props.student.rawValues[subject.id])
  }
  return props.student.gradeValues[subject.id] || '--'
}

const getScoreLengthClass = (subject: ScoreNoticeSubjectType): string => {
  if (props.mode !== ScoreNoticeModeEnum.Score) return ''
  const length = getDisplayValue(subject).length
  if (length === 3) return 'score-report__grade-medal--score-length-3'
  if (length >= 4) return 'score-report__grade-medal--score-length-4'
  return ''
}

const getGradeRibbonUrl = (index: number): string => gradeRibbonUrls[index % gradeRibbonUrls.length]

const getGradeCaption = (subject: ScoreNoticeSubjectType): string => {
  const grade = props.student?.gradeValues[subject.id]
  if (grade === 'A') return '表现优秀'
  if (grade === 'B') return '表现良好'
  if (grade === 'C') return '继续努力'
  return '暂无数据'
}

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

defineExpose({
  getElement: (): HTMLElement | null => reportElement.value
})
</script>

<template>
  <article
    ref="reportElement"
    class="score-report"
    :class="`score-report--subjects-${subjectLayout}`"
  >
    <img class="score-report__paper" :src="reportPaperUrl" alt="" aria-hidden="true" />
    <div class="score-report__outer-frame" aria-hidden="true"></div>
    <img
      v-for="position in ['top-left', 'top-right', 'bottom-left', 'bottom-right']"
      :key="`watermark-${position}`"
      class="score-report__watermark"
      :class="`score-report__watermark--${position}`"
      :src="paperFloralWatermarkUrl"
      alt=""
      aria-hidden="true"
    />

    <div class="score-report__inner">
      <img
        v-for="position in ['top-left', 'top-right', 'bottom-left', 'bottom-right']"
        :key="`report-corner-${position}`"
        class="score-report__corner"
        :class="`score-report__corner--${position}`"
        :src="reportCornerUrl"
        alt=""
        aria-hidden="true"
      />

      <header class="score-report__header">
        <div class="score-report__heading-group">
          <img class="score-report__logo" :src="logoUrl" alt="" aria-hidden="true" />
          <div class="score-report__title-wrap">
            <div class="score-report__title-cap" aria-hidden="true">
              <span></span><i>✦</i><span></span>
            </div>
            <h1 :class="titleLengthClass">{{ title || '考试成绩通知' }}</h1>
            <div class="score-report__title-ornament" aria-hidden="true">
              <span></span>
              <img :src="ornamentLaurelUrl" alt="" />
              <img class="score-report__title-star" :src="ornamentStarUrl" alt="" />
              <img class="score-report__title-laurel--right" :src="ornamentLaurelUrl" alt="" />
              <span></span>
            </div>
          </div>
        </div>
      </header>

      <div v-if="student" class="score-report__content">
        <div class="score-report__meta">
          <div>
            <span>学生姓名：</span
            ><strong class="score-report__student-name">{{ student.name }}</strong>
          </div>
          <div class="score-report__meta-divider"><i>✦</i></div>
          <div>
            <span>日期：</span><strong>{{ noticeDate }}</strong>
          </div>
        </div>

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
                <img
                  class="score-report__grade-wreath"
                  :src="gradeLaurelUrl"
                  alt=""
                  aria-hidden="true"
                />
                <div class="score-report__grade-ring">
                  <span
                    :class="{ 'score-report__score-value': mode === ScoreNoticeModeEnum.Score }"
                  >
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

        <section
          class="score-report__comment"
          :class="{ 'score-report__comment--long': commentLength > 300 }"
        >
          <img
            v-for="position in ['top-left', 'top-right', 'bottom-left', 'bottom-right']"
            :key="`comment-corner-${position}`"
            class="score-report__comment-corner"
            :class="`score-report__comment-corner--${position}`"
            :src="commentBoxCornerUrl"
            alt=""
            aria-hidden="true"
          />
          <div class="score-report__comment-badge" aria-hidden="true">
            <img :src="teacherCommentBadgeUrl" alt="" />
            <strong>教师评语</strong>
          </div>
          <div class="score-report__comment-body">
            <font-awesome-icon class="score-report__quote" :icon="['solid', 'quote-left']" />
            <p>{{ student.comment || '评语待生成，可在右侧使用AI生成或手动编辑。' }}</p>
            <font-awesome-icon
              class="score-report__quote score-report__quote--right"
              :icon="['solid', 'quote-right']"
            />
          </div>
        </section>
      </div>

      <div v-else class="score-report__empty">
        <font-awesome-icon :icon="['solid', 'file-circle-plus']" />
        <strong>导入成绩后预览学生报告</strong>
        <span>支持等级或分数格式的 Excel</span>
      </div>
    </div>
  </article>
</template>

<style scoped lang="scss">
.score-report {
  position: relative;
  width: 1448px;
  min-height: 1086px;
  padding: 18px;
  overflow: hidden;
  box-sizing: border-box;
  color: #123f3a;
  background: #f8eed8;
  border: 14px solid #154c46;
  font-family: STSong, 'Songti SC', SimSun, 'Noto Serif CJK SC', serif;
}
.score-report__paper {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.score-report__outer-frame,
.score-report__outer-frame::before,
.score-report__outer-frame::after {
  position: absolute;
  pointer-events: none;
  content: '';
}
.score-report__outer-frame {
  inset: 5px;
  z-index: 2;
  border: 2px solid #c79a43;
}
.score-report__outer-frame::before {
  inset: 4px;
  border: 3px solid #6f501f;
}
.score-report__outer-frame::after {
  inset: 10px;
  border: 2px solid #f3dfac;
  box-shadow: inset 0 0 0 1px #b78635;
}
.score-report__watermark {
  position: absolute;
  z-index: 1;
  width: 290px;
  height: 290px;
}
.score-report__watermark--top-left {
  top: 36px;
  left: 36px;
}
.score-report__watermark--top-right {
  top: 36px;
  right: 36px;
  transform: scaleX(-1);
}
.score-report__watermark--bottom-left {
  bottom: 36px;
  left: 36px;
  transform: scaleY(-1);
}
.score-report__watermark--bottom-right {
  right: 36px;
  bottom: 36px;
  transform: scale(-1);
}
.score-report__inner {
  position: relative;
  z-index: 2;
  min-height: 1022px;
  padding: 54px 72px 48px;
  box-sizing: border-box;
  background: transparent;
  border: 2px solid #b68a37;
  outline: 1px solid rgba(118, 85, 31, 0.82);
  outline-offset: -7px;
  box-shadow:
    inset 0 0 0 3px rgba(239, 213, 151, 0.82),
    inset 0 0 0 9px rgba(183, 133, 49, 0.46),
    0 2px 7px rgba(72, 48, 14, 0.18);
}
.score-report__corner {
  position: absolute;
  z-index: 3;
  width: 130px;
  height: 130px;
  object-fit: contain;
}
.score-report__corner--top-left {
  top: 2px;
  left: 2px;
}
.score-report__corner--top-right {
  top: 2px;
  right: 2px;
  transform: scaleX(-1);
}
.score-report__corner--bottom-left {
  bottom: 2px;
  left: 2px;
  transform: scaleY(-1);
}
.score-report__corner--bottom-right {
  right: 2px;
  bottom: 2px;
  transform: scale(-1);
}
.score-report__header {
  position: relative;
  z-index: 4;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 230px;
  padding: 0 55px;
}
.score-report__heading-group {
  display: flex;
  align-items: center;
  gap: 24px;
  min-width: 0;
  transform: translateX(-52px);
}
.score-report__logo {
  flex: 0 0 auto;
  width: 190px;
  height: 190px;
  object-fit: contain;
  filter: drop-shadow(0 8px 10px rgba(63, 41, 11, 0.2))
    drop-shadow(0 2px 2px rgba(63, 41, 11, 0.16));
}
.score-report__title-wrap {
  position: relative;
  min-width: 0;
  width: fit-content;
  max-width: 900px;
  padding: 28px 0 52px;
}
.score-report__title-wrap h1 {
  max-width: 900px;
  margin: 0;
  overflow-wrap: anywhere;
  color: #123f3a;
  font-family: STSong, 'Songti SC', 'Noto Serif CJK SC', SimSun, serif;
  font-size: 80px;
  font-weight: 700;
  font-synthesis: weight;
  line-height: 1.1;
  text-align: center;
  letter-spacing: 4px;
  -webkit-text-stroke: 0.5px rgba(18, 63, 58, 0.5);
  text-shadow:
    0 2px 0 rgba(255, 248, 224, 0.9),
    0 3px 5px rgba(48, 34, 11, 0.16);
}
.score-report__title-wrap h1.score-report__title--medium {
  font-size: 68px;
  letter-spacing: 3px;
}
.score-report__title-wrap h1.score-report__title--long {
  font-size: 56px;
  letter-spacing: 2px;
}
.score-report__title-cap,
.score-report__title-ornament {
  position: absolute;
  left: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #b4822f;
  transform: translateX(-50%);
}
.score-report__title-cap {
  top: 0;
  gap: 12px;
  font-size: 20px;
}
.score-report__title-cap span {
  width: 210px;
  height: 1px;
  background: linear-gradient(90deg, transparent, #b4822f);
}
.score-report__title-cap span:last-child {
  transform: scaleX(-1);
}
.score-report__title-ornament {
  bottom: 0;
  gap: 10px;
}
.score-report__title-ornament > span {
  width: 145px;
  height: 1px;
  background: linear-gradient(90deg, transparent, #b4822f 28%, #d9b45f 72%, transparent);
}
.score-report__title-ornament > img {
  width: 82px;
  height: 33px;
  object-fit: contain;
  filter: drop-shadow(0 2px 2px rgba(92, 59, 13, 0.24));
}
.score-report__title-ornament .score-report__title-star {
  width: 34px;
  height: 34px;
  filter: drop-shadow(0 2px 2px rgba(92, 59, 13, 0.27)) drop-shadow(0 0 3px rgba(234, 196, 91, 0.5));
}
.score-report__title-laurel--right {
  transform: none;
}
.score-report__title-ornament > img:nth-of-type(1) {
  transform: scaleX(-1);
}
.score-report__content {
  position: relative;
  z-index: 4;
}
.score-report__meta {
  display: grid;
  grid-template-columns: 1fr minmax(160px, 1.7fr) 1fr;
  align-items: center;
  gap: 20px;
  margin: 8px 30px 28px;
  color: #172e2b;
  font-size: 24px;
  line-height: 1;
}
.score-report__meta > div:not(.score-report__meta-divider) {
  display: flex;
  align-items: center;
  min-height: 38px;
}
.score-report__meta > div:last-child {
  justify-content: flex-end;
  text-align: right;
}
.score-report__meta span {
  display: inline-flex;
  align-items: center;
  height: 38px;
  line-height: 38px;
}
.score-report__meta strong {
  display: inline-flex;
  align-items: center;
  height: 38px;
  margin-left: 8px;
  color: #123f3a;
  font-size: 31px;
  font-weight: 800;
  line-height: 38px;
  font-variant-numeric: tabular-nums;
  text-shadow: 0 1px 0 rgba(255, 247, 220, 0.7);
}
.score-report__student-name {
  font-family: EvaluationHandwriteFont, FYFont, 'KaiTi SC', KaiTi, cursive;
  font-weight: 700;
}
.score-report__meta-divider {
  display: flex;
  align-items: center;
  gap: 10px;
  color: #b4822f;
}
.score-report__meta-divider::before,
.score-report__meta-divider::after {
  flex: 1;
  height: 1px;
  content: '';
  background: linear-gradient(90deg, transparent, rgba(180, 130, 47, 0.65), #d9b45f);
}
.score-report__meta-divider::after {
  transform: scaleX(-1);
}
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
.score-report__subject-corner,
.score-report__comment-corner {
  position: absolute;
  width: 34px;
  height: 34px;
}
.score-report__subject-corner--top-left,
.score-report__comment-corner--top-left {
  top: -2px;
  left: -2px;
}
.score-report__subject-corner--top-right,
.score-report__comment-corner--top-right {
  top: -2px;
  right: -2px;
  transform: scaleX(-1);
}
.score-report__subject-corner--bottom-left,
.score-report__comment-corner--bottom-left {
  bottom: -2px;
  left: -2px;
  transform: scaleY(-1);
}
.score-report__subject-corner--bottom-right,
.score-report__comment-corner--bottom-right {
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
.score-report__comment {
  position: relative;
  min-height: 222px;
  margin: 34px 8px 0;
  padding: 20px 40px 24px 252px;
  box-sizing: border-box;
  background: linear-gradient(160deg, rgba(255, 255, 255, 0.7), rgba(246, 229, 190, 0.5));
  border: 1px solid rgba(181, 130, 48, 0.78);
  box-shadow:
    0 9px 18px rgba(78, 50, 15, 0.18),
    0 3px 5px rgba(78, 50, 15, 0.12),
    inset 0 1px 0 rgba(255, 255, 255, 0.88),
    inset 0 -3px 6px rgba(155, 105, 28, 0.1);
}
.score-report__comment--long {
  min-height: 258px;
}
.score-report__comment-corner {
  width: 48px;
  height: 48px;
}
.score-report__comment-corner--top-left {
  top: -3px;
  left: -10px;
}
.score-report__comment-corner--top-right {
  top: -3px;
  right: -10px;
}
.score-report__comment-corner--bottom-left {
  bottom: -3px;
  left: -10px;
}
.score-report__comment-corner--bottom-right {
  right: -10px;
  bottom: -3px;
}
.score-report__comment-badge {
  position: absolute;
  top: -12px;
  left: 22px;
  width: 220px;
  height: 260px;
}
.score-report__comment-badge img {
  width: 100%;
  height: 100%;
  object-fit: fill;
}
.score-report__comment-badge strong {
  position: absolute;
  right: 4px;
  bottom: 65px;
  left: 4px;
  color: #f1cb70;
  font-size: 26px;
  font-weight: 700;
  text-align: center;
  white-space: nowrap;
  letter-spacing: 1px;
  text-shadow: 0 1px 1px #3d2a0e;
}
.score-report__comment-body {
  position: relative;
  display: grid;
  grid-template-columns: 36px minmax(0, 1fr) 36px;
  gap: 18px;
  align-items: start;
  min-height: 168px;
}
.score-report__quote {
  margin-top: 6px;
  color: #aa7926;
  font-size: 30px;
}
.score-report__quote--right {
  align-self: end;
  margin: 0 0 5px;
}
.score-report__comment-body p {
  margin: 3px 0 0;
  color: #303735;
  font-family: EvaluationHandwriteFont, FYFont, 'KaiTi SC', KaiTi, cursive;
  font-size: 20px;
  line-height: 1.68;
  text-align: left;
  white-space: pre-wrap;
}
.score-report__comment--long .score-report__comment-body p {
  font-size: 18px;
  line-height: 1.58;
}
.score-report--subjects-compact .score-report__header {
  min-height: 195px;
  padding: 0 42px;
}
.score-report--subjects-compact .score-report__logo {
  width: 148px;
  height: 148px;
  margin-right: 25px;
}
.score-report--subjects-compact .score-report__title-wrap h1 {
  font-size: 63px;
}
.score-report--subjects-compact .score-report__meta {
  margin-top: 2px;
  margin-bottom: 18px;
  font-size: 21px;
}
.score-report--subjects-compact .score-report__meta strong {
  font-size: 27px;
}
.score-report--subjects-compact .score-report__subject-grid {
  gap: 14px;
}
.score-report--subjects-compact .score-report__subject {
  min-height: 178px;
  padding: 14px 7px 10px;
}
.score-report--subjects-compact .score-report__subject-name {
  min-height: 28px;
  gap: 6px;
  font-size: 19px;
}
.score-report--subjects-compact .score-report__subject-separator {
  margin: 1px 18px 0;
}
.score-report--subjects-compact .score-report__grade-medal {
  width: 118px;
  height: 114px;
  margin: 0 auto -2px;
}
.score-report--subjects-compact .score-report__grade-wreath {
  inset: 3px 4px 4px;
  width: 110px;
  height: 110px;
}
.score-report--subjects-compact .score-report__grade-ring {
  top: 23px;
  left: 30px;
  width: 56px;
  height: 56px;
  border-width: 3px;
}
.score-report--subjects-compact .score-report__grade-ring span {
  bottom: 10px;
  font-size: 37px;
}
.score-report--subjects-compact .score-report__grade-ring img {
  bottom: 1px;
  width: 10px;
  height: 10px;
}
.score-report--subjects-compact .score-report__grade-ring .score-report__score-value {
  font-size: 30px;
  letter-spacing: -0.5px;
}
.score-report--subjects-compact
  .score-report__grade-medal--score-length-4
  .score-report__score-value {
  font-size: 27px;
  letter-spacing: -0.5px;
}
.score-report--subjects-compact .score-report__grade-ribbon {
  right: 9px;
  bottom: 0;
  left: 9px;
  height: 36px;
}
.score-report--subjects-compact .score-report__grade-caption {
  font-size: 17px;
}
.score-report--subjects-compact .score-report__comment {
  margin-top: 22px;
}
.score-report--subjects-dense .score-report__header {
  min-height: 165px;
  padding: 0 26px;
}
.score-report--subjects-dense .score-report__logo {
  width: 124px;
  height: 124px;
  margin-right: 18px;
}
.score-report--subjects-dense .score-report__title-wrap h1 {
  font-size: 54px;
  letter-spacing: 3px;
}
.score-report--subjects-dense .score-report__title-cap {
  display: none;
}
.score-report--subjects-dense .score-report__title-ornament {
  margin-top: 10px;
}
.score-report--subjects-dense .score-report__title-ornament > span {
  width: 96px;
}
.score-report--subjects-dense .score-report__title-ornament > img {
  width: 57px;
  height: 24px;
}
.score-report--subjects-dense .score-report__title-ornament .score-report__title-star {
  width: 25px;
  height: 25px;
}
.score-report--subjects-dense .score-report__meta {
  margin: 0 20px 12px;
  font-size: 18px;
}
.score-report--subjects-dense .score-report__meta > div:not(.score-report__meta-divider),
.score-report--subjects-dense .score-report__meta span,
.score-report--subjects-dense .score-report__meta strong {
  min-height: 30px;
  height: 30px;
  line-height: 30px;
}
.score-report--subjects-dense .score-report__meta strong {
  font-size: 23px;
}
.score-report--subjects-dense .score-report__subject-grid {
  gap: 10px;
}
.score-report--subjects-dense .score-report__subject {
  min-height: 128px;
  padding: 9px 4px 6px;
}
.score-report--subjects-dense .score-report__subject-corner {
  width: 25px;
  height: 25px;
}
.score-report--subjects-dense .score-report__subject-name {
  min-height: 22px;
  gap: 4px;
  font-size: 16px;
}
.score-report--subjects-dense .score-report__subject-separator {
  display: none;
}
.score-report--subjects-dense .score-report__grade-medal {
  width: 88px;
  height: 82px;
  margin: 0 auto -2px;
}
.score-report--subjects-dense .score-report__grade-wreath {
  inset: 2px 3px 3px;
  width: 82px;
  height: 82px;
}
.score-report--subjects-dense .score-report__grade-ring {
  top: 17px;
  left: 23px;
  width: 39px;
  height: 39px;
  border-width: 2px;
}
.score-report--subjects-dense .score-report__grade-ring span {
  bottom: 2px;
  font-size: 28px;
}
.score-report--subjects-dense .score-report__grade-ring img {
  display: none;
}
.score-report--subjects-dense .score-report__grade-ring .score-report__score-value {
  font-size: 23px;
  letter-spacing: -0.4px;
}
.score-report--subjects-dense
  .score-report__grade-medal--score-length-4
  .score-report__score-value {
  font-size: 19px;
  letter-spacing: -0.4px;
}
.score-report--subjects-dense .score-report__grade-ribbon {
  right: 6px;
  bottom: 0;
  left: 6px;
  height: 26px;
}
.score-report--subjects-dense .score-report__grade-caption {
  font-size: 14px;
}
.score-report--subjects-dense .score-report__comment {
  min-height: 194px;
  margin-top: 16px;
  padding-top: 15px;
  padding-bottom: 15px;
}
.score-report--subjects-dense .score-report__comment--long {
  min-height: 222px;
}
.score-report--subjects-dense .score-report__comment-body {
  min-height: 136px;
}
.score-report--subjects-dense .score-report__comment-body p {
  font-size: 17px;
  line-height: 1.52;
}
.score-report--subjects-dense .score-report__comment--long .score-report__comment-body p {
  font-size: 16px;
  line-height: 1.45;
}
.score-report__empty {
  position: relative;
  z-index: 4;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 690px;
  color: #78908c;
  font-family: system-ui, sans-serif;
}
.score-report__empty svg {
  margin-bottom: 20px;
  font-size: 64px;
}
.score-report__empty strong {
  color: #315b59;
  font-size: 26px;
}
.score-report__empty span {
  margin-top: 8px;
  font-size: 17px;
}
</style>
