<script setup lang="ts">
/**
 * 检查并导出栏
 * 汇总可导出状态，提供复制当前图片与导出全部图片 ZIP 的操作。
 */
import { computed } from 'vue'

import { useScoreNoticeStore } from '@/stores/score-notice'

interface Props {
  exporting: boolean
  exportProcessed: number
  processing: boolean
  hasUnsavedComment: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  copyImage: []
  exportZip: []
}>()

const store = useScoreNoticeStore()
const selectedStudent = computed(() => store.selectedStudent)
/** 待处理/需修改/缺数据的学生总数 */
const issueCount = computed(() => store.pendingCount + store.reviewCount + store.missingCount)
/** 当前可直接导出的学生数 */
const readyCount = computed(() => Math.max(store.students.length - issueCount.value, 0))
const isReady = computed(
  () =>
    store.students.length > 0 &&
    issueCount.value === 0 &&
    !props.processing &&
    !props.hasUnsavedComment
)

/** 依据当前状态生成导出状态提示 */
const readinessText = computed(() => {
  if (!store.students.length) return '完成前面步骤后即可导出'
  if (props.processing) return '正在生成评语，请稍候'
  if (props.hasUnsavedComment) return '请先保存当前学生的评语修改'
  if (isReady.value) return `${store.students.length} 名学生均已准备完成`
  return `${readyCount.value} 名可导出 · ${issueCount.value} 项待确认`
})
</script>

<template>
  <section class="notice-export" :class="{ 'is-ready': isReady }">
    <div class="notice-export__head">
      <span class="notice-export__index">
        <font-awesome-icon v-if="isReady" :icon="['solid', 'check']" />
        <span v-else>4</span>
      </span>
      <span class="notice-export__heading">
        <strong>检查并导出</strong>
        <small>{{ readinessText }}</small>
      </span>
      <el-tooltip
        v-if="issueCount"
        :content="`${store.pendingCount} 人待处理，${store.reviewCount} 人需修改，${store.missingCount} 人缺少数据`"
        placement="top"
      >
        <el-tag type="warning" size="small" effect="plain">仍可导出</el-tag>
      </el-tooltip>
    </div>

    <div class="notice-export__actions">
      <el-button
        :disabled="!selectedStudent || exporting || processing || hasUnsavedComment"
        @click="emit('copyImage')"
      >
        <font-awesome-icon :icon="['regular', 'copy']" />
        复制当前图片
      </el-button>
      <el-button
        type="primary"
        :loading="exporting"
        :disabled="!store.students.length || processing || hasUnsavedComment"
        @click="emit('exportZip')"
      >
        <font-awesome-icon v-if="!exporting" :icon="['solid', 'download']" />
        {{
          exporting
            ? `正在导出 ${exportProcessed}/${store.students.length}`
            : issueCount
              ? `导出全部 · ${issueCount} 项待确认`
              : '导出全部图片 ZIP'
        }}
      </el-button>
    </div>
  </section>
</template>

<style scoped lang="scss">
.notice-export {
  flex: 0 0 auto;
  padding: 13px 18px 15px;
  background: var(--el-bg-color);
  border-top: 1px solid var(--el-border-color-light);
  box-shadow: 0 -5px 16px rgb(0 0 0 / 5%);
}
.notice-export.is-ready {
  background: linear-gradient(180deg, var(--el-color-success-light-9), var(--el-bg-color) 72%);
}
.notice-export__head {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
}
.notice-export__index {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  color: #fff;
  font-size: 13px;
  font-weight: 700;
  background: var(--el-color-primary);
  border-radius: 50%;
}
.is-ready .notice-export__index {
  background: var(--el-color-success);
}
.notice-export__heading {
  display: flex;
  flex: 1;
  min-width: 0;
  flex-direction: column;
  gap: 2px;
}
.notice-export__heading strong {
  color: var(--el-text-color-primary);
  font-size: 13px;
}
.notice-export__heading small {
  color: var(--el-text-color-secondary);
  font-size: 10px;
}
.notice-export__actions {
  display: grid;
  grid-template-columns: 0.9fr 1.45fr;
  gap: 9px;
}
.notice-export__actions .el-button {
  margin: 0;
}
.notice-export__actions svg {
  margin-right: 6px;
}
</style>
