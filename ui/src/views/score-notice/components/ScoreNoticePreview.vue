<script setup lang="ts">
import { computed, ref } from 'vue'

import paperFloralWatermarkUrl from '@/assets/score-notice/paper-floral-watermark-2x.png'
import reportCornerUrl from '@/assets/score-notice/report-corner-ornament-2x.png'
import reportPaperUrl from '@/assets/score-notice/report-paper-background.png'
import { ScoreNoticeModeEnum } from '@/types/ScoreNotice'
import ScoreNoticePreviewHeader from './ScoreNoticePreviewHeader.vue'
import ScoreNoticePreviewSubjects from './ScoreNoticePreviewSubjects.vue'
import ScoreNoticePreviewComment from './ScoreNoticePreviewComment.vue'

import type { ScoreNoticeStudentType, ScoreNoticeSubjectType } from '@/types/ScoreNotice'

interface Props {
  /** 通知单标题 */
  title: string
  /** 服务器页面可使用手工评语提示，旧本地页面保持原提示。 */
  emptyComment?: string
  /** 通知日期 */
  noticeDate: string
  /** 展示模式：分数或等级 */
  mode: ScoreNoticeModeEnum
  /** 科目列表 */
  subjects: ScoreNoticeSubjectType[]
  /** 当前预览的学生，未选择时为 null */
  student: ScoreNoticeStudentType | null
}

const props = defineProps<Props>()

const reportElement = ref<HTMLElement | null>(null)

/** 外层纸张密度与科目卡片使用相同的数量阈值。 */
const subjectLayout = computed(() =>
  props.subjects.length <= 5 ? 'standard' : props.subjects.length <= 10 ? 'compact' : 'dense'
)

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
    <!-- 纸张背景与外框装饰 -->
    <img class="score-report__paper" :src="reportPaperUrl" alt="" aria-hidden="true" />
    <div class="score-report__outer-frame" aria-hidden="true"></div>
    <!-- 四角花纹水印 -->
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
      <!-- 内框四角装饰 -->
      <img
        v-for="position in ['top-left', 'top-right', 'bottom-left', 'bottom-right']"
        :key="`report-corner-${position}`"
        class="score-report__corner"
        :class="`score-report__corner--${position}`"
        :src="reportCornerUrl"
        alt=""
        aria-hidden="true"
      />

      <!-- 页眉：校徽与通知标题 -->
      <ScoreNoticePreviewHeader :title="title" />

      <div v-if="student" class="score-report__content">
        <!-- 学生姓名与通知日期 -->
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

        <!-- 科目成绩卡片区 -->
        <ScoreNoticePreviewSubjects :mode="mode" :subjects="subjects" :student="student" />

        <!-- 教师评语区 -->
        <ScoreNoticePreviewComment :student="student" :empty-comment="emptyComment" />
      </div>

      <!-- 未选择学生时的空状态 -->
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
.score-report--subjects-compact .score-report__meta {
  margin-top: 2px;
  margin-bottom: 18px;
  font-size: 21px;
}
.score-report--subjects-compact .score-report__meta strong {
  font-size: 27px;
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
