<script setup lang="ts">
import { computed } from 'vue'

import commentBoxCornerUrl from '@/assets/score-notice/comment-box-corner-2x.png'
import teacherCommentBadgeUrl from '@/assets/score-notice/teacher-comment-badge-2x.png'

import type { ScoreNoticeStudentType } from '@/types/ScoreNotice'

const props = defineProps<{ student: ScoreNoticeStudentType; emptyComment?: string }>()

/** 评语去掉空白后的字符数，用于判断是否启用长文样式 */
const commentLength = computed(() => (props.student?.comment || '').replace(/\s/g, '').length)
</script>

<template>
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
      <p>{{ student.comment || emptyComment || '评语待生成，可在右侧使用AI生成或手动编辑。' }}</p>
      <font-awesome-icon
        class="score-report__quote score-report__quote--right"
        :icon="['solid', 'quote-right']"
      />
    </div>
  </section>
</template>

<style scoped lang="scss">
.score-report__comment-corner {
  position: absolute;
  width: 34px;
  height: 34px;
}
.score-report__comment-corner--top-left {
  top: -2px;
  left: -2px;
}
.score-report__comment-corner--top-right {
  top: -2px;
  right: -2px;
  transform: scaleX(-1);
}
.score-report__comment-corner--bottom-left {
  bottom: -2px;
  left: -2px;
  transform: scaleY(-1);
}
.score-report__comment-corner--bottom-right {
  right: -2px;
  bottom: -2px;
  transform: scale(-1);
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
:global(.score-report--subjects-compact .score-report__comment) {
  margin-top: 22px;
}
:global(.score-report--subjects-dense .score-report__comment) {
  min-height: 194px;
  margin-top: 16px;
  padding-top: 15px;
  padding-bottom: 15px;
}
:global(.score-report--subjects-dense .score-report__comment--long) {
  min-height: 222px;
}
:global(.score-report--subjects-dense .score-report__comment-body) {
  min-height: 136px;
}
:global(.score-report--subjects-dense .score-report__comment-body p) {
  font-size: 17px;
  line-height: 1.52;
}
:global(.score-report--subjects-dense .score-report__comment--long .score-report__comment-body p) {
  font-size: 16px;
  line-height: 1.45;
}
</style>
