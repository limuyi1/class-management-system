<script setup lang="ts">
/** 座位表弹窗通用头部 — 展示图标、标题与说明，并支持主题色调 */
withDefaults(defineProps<{
  /** FontAwesome 图标名称 */
  icon: string
  /** 弹窗标题 */
  title: string
  /** 标题下方的说明文字 */
  description: string
  /** 主题色调 */
  tone?: 'purple' | 'gold' | 'orange'
}>(), { tone: 'purple' })
</script>

<template>
  <div class="seating-dialog-header" :class="`seating-dialog-header--${tone}`">
    <span class="seating-dialog-header__icon"><font-awesome-icon :icon="['solid', icon]" /></span>
    <div><strong>{{ title }}</strong><p>{{ description }}</p></div>
  </div>
</template>

<style scoped lang="scss">
.seating-dialog-header { display:flex; align-items:center; gap:10px; }.seating-dialog-header__icon { display:grid; width:34px; height:34px; place-items:center; flex-shrink:0; color:#6941aa; background:#f0e8fc; border-radius:10px; }.seating-dialog-header strong { color:#352b3f; font-size:15px; }.seating-dialog-header p { margin:2px 0 0; color:#92889b; font-size:11px; }.seating-dialog-header--gold .seating-dialog-header__icon { color:#9b680f; background:#fff0c5; }.seating-dialog-header--orange .seating-dialog-header__icon { color:#b8551e; background:#ffeadc; }
</style>
