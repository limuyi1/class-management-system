<script setup lang="ts">
import { computed } from 'vue'

import logoUrl from '@/assets/score-notice/logo-transparent.png'
import ornamentLaurelUrl from '@/assets/score-notice/ornament-laurel-2x.png'
import ornamentStarUrl from '@/assets/score-notice/ornament-star-2x.png'

const props = defineProps<{ title: string }>()

/** 依据标题长度返回字体缩放类名 */
const titleLengthClass = computed(() => {
  const length = (props.title || '考试成绩通知').replace(/\s/g, '').length
  if (length > 16) return 'score-report__title--long'
  if (length > 10) return 'score-report__title--medium'
  return ''
})
</script>

<template>
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
</template>

<style scoped lang="scss">
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
:global(.score-report--subjects-compact .score-report__header) {
  min-height: 195px;
  padding: 0 42px;
}
:global(.score-report--subjects-compact .score-report__logo) {
  width: 148px;
  height: 148px;
  margin-right: 25px;
}
:global(.score-report--subjects-compact .score-report__title-wrap h1) {
  font-size: 63px;
}
:global(.score-report--subjects-dense .score-report__header) {
  min-height: 165px;
  padding: 0 26px;
}
:global(.score-report--subjects-dense .score-report__logo) {
  width: 124px;
  height: 124px;
  margin-right: 18px;
}
:global(.score-report--subjects-dense .score-report__title-wrap h1) {
  font-size: 54px;
  letter-spacing: 3px;
}
:global(.score-report--subjects-dense .score-report__title-cap) {
  display: none;
}
:global(.score-report--subjects-dense .score-report__title-ornament) {
  margin-top: 10px;
}
:global(.score-report--subjects-dense .score-report__title-ornament > span) {
  width: 96px;
}
:global(.score-report--subjects-dense .score-report__title-ornament > img) {
  width: 57px;
  height: 24px;
}
:global(.score-report--subjects-dense .score-report__title-ornament .score-report__title-star) {
  width: 25px;
  height: 25px;
}
</style>
