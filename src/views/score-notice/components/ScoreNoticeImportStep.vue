<script setup lang="ts">
/**
 * 导入成绩步骤
 * 未导入时展示导入入口，已导入时展示文件摘要与重新导入入口。
 */
import { computed } from 'vue'

import { useScoreNoticeStore } from '@/stores/score-notice'

interface Props {
  expanded: boolean
}

defineProps<Props>()

const emit = defineEmits<{
  toggle: []
  openImport: []
}>()

const store = useScoreNoticeStore()
/** 是否已导入学生数据 */
const hasImportedData = computed(() => store.students.length > 0)
</script>

<template>
  <section class="notice-step" :class="{ 'is-complete': hasImportedData }">
    <button
      class="notice-step__head"
      type="button"
      data-testid="notice-section-import"
      :aria-expanded="expanded"
      @click="emit('toggle')"
    >
      <span class="notice-step__index">
        <font-awesome-icon v-if="hasImportedData" :icon="['solid', 'check']" />
        <span v-else>1</span>
      </span>
      <span class="notice-step__heading">
        <strong>导入成绩</strong>
        <small v-if="hasImportedData">{{ store.students.length }} 名学生已就绪</small>
        <small v-else>从 Excel 开始创建成绩通知</small>
      </span>
      <font-awesome-icon
        class="notice-step__chevron"
        :class="{ 'is-expanded': expanded }"
        :icon="['solid', 'chevron-down']"
      />
    </button>

    <!-- 步骤内容：未导入时显示导入入口卡片，已导入时显示文件摘要 -->
    <div v-show="expanded" class="notice-step__body">
      <button
        v-if="!hasImportedData"
        class="notice-import-card"
        type="button"
        @click="emit('openImport')"
      >
        <span class="notice-import-card__icon">
          <font-awesome-icon :icon="['solid', 'file-excel']" />
        </span>
        <span class="notice-import-card__content">
          <strong>选择 Excel 成绩表</strong>
          <small>支持等级或具体分数，系统会自动识别姓名和科目</small>
        </span>
        <font-awesome-icon class="notice-import-card__arrow" :icon="['solid', 'arrow-right']" />
      </button>

      <div v-else class="notice-file-summary">
        <span class="notice-file-summary__icon">
          <font-awesome-icon :icon="['solid', 'file-excel']" />
        </span>
        <span class="notice-file-summary__content">
          <strong :title="store.sourceFileName">{{ store.sourceFileName }}</strong>
          <small>{{ store.students.length }} 名学生 · {{ store.subjects.length }} 个科目</small>
        </span>
        <el-button size="small" @click="emit('openImport')">重新导入</el-button>
      </div>
    </div>
  </section>
</template>

<style scoped lang="scss">
.notice-step {
  padding: 15px 18px;
  border-bottom: 1px solid var(--el-border-color-light);
}
.notice-step__head {
  display: flex;
  align-items: center;
  gap: 11px;
  width: 100%;
  padding: 0;
  color: var(--el-text-color-primary);
  text-align: left;
  background: transparent;
  border: 0;
  cursor: pointer;
}
.notice-step__head:focus-visible,
.notice-import-card:focus-visible {
  outline: 2px solid var(--el-color-primary-light-5);
  outline-offset: 3px;
}
.notice-step__index {
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
.is-complete .notice-step__index {
  background: var(--el-color-success);
}
.notice-step__heading {
  display: flex;
  flex: 1;
  min-width: 0;
  flex-direction: column;
  gap: 2px;
}
.notice-step__heading strong {
  font-size: 15px;
}
.notice-step__heading small {
  overflow: hidden;
  color: var(--el-text-color-secondary);
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.notice-step__chevron {
  color: var(--el-text-color-secondary);
  font-size: 11px;
  transition: transform 0.18s ease;
}
.notice-step__chevron.is-expanded {
  transform: rotate(180deg);
}
.notice-step__body {
  margin-top: 13px;
}
.notice-import-card {
  display: grid;
  grid-template-columns: 44px minmax(0, 1fr) auto;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 14px;
  color: var(--el-text-color-primary);
  text-align: left;
  background: linear-gradient(135deg, var(--el-color-primary-light-9), var(--el-bg-color));
  border: 1px dashed var(--el-color-primary-light-5);
  border-radius: 8px;
  cursor: pointer;
  transition:
    border-color 0.18s ease,
    transform 0.18s ease;
}
.notice-import-card:hover {
  border-color: var(--el-color-primary);
  transform: translateY(-1px);
}
.notice-import-card__icon,
.notice-file-summary__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  color: var(--el-color-primary);
  background: var(--el-bg-color);
  border: 1px solid var(--el-color-primary-light-7);
  border-radius: 8px;
}
.notice-import-card__content,
.notice-file-summary__content {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 4px;
}
.notice-import-card__content strong,
.notice-file-summary__content strong {
  overflow: hidden;
  font-size: 13px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.notice-import-card__content small,
.notice-file-summary__content small {
  color: var(--el-text-color-secondary);
  font-size: 11px;
  line-height: 1.5;
}
.notice-import-card__arrow {
  color: var(--el-color-primary);
  font-size: 12px;
}
.notice-file-summary {
  display: grid;
  grid-template-columns: 42px minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
  padding: 10px;
  background: var(--el-fill-color-lighter);
  border: 1px solid var(--el-border-color-light);
  border-radius: 7px;
}
</style>
