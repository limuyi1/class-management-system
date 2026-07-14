<script setup lang="ts">
import { computed, shallowRef } from 'vue'

import { useScoreNoticeStore } from '@/stores/score-notice'
import { ScoreNoticeModeEnum } from '@/types/ScoreNotice'

interface Props {
  expanded: boolean
  disabled: boolean
  handwriteFontName: string
  hasCustomHandwriteFont: boolean
  handwriteFontApplying: boolean
}

defineProps<Props>()

const emit = defineEmits<{
  toggle: []
  continue: []
  chooseHandwriteFont: []
  clearHandwriteFont: []
}>()

const store = useScoreNoticeStore()
const appearanceExpanded = shallowRef(false)
const canUseScoreMode = computed(() => store.sourceMode === ScoreNoticeModeEnum.Score)

const handleModeChange = (value: string | number | boolean | undefined): void => {
  if (value === ScoreNoticeModeEnum.Grade) store.mode = value
  if (value === ScoreNoticeModeEnum.Score && canUseScoreMode.value) store.mode = value
}
</script>

<template>
  <section class="notice-step" :class="{ 'is-disabled': disabled }">
    <button
      class="notice-step__head"
      type="button"
      data-testid="notice-section-settings"
      :aria-expanded="expanded"
      :disabled="disabled"
      @click="emit('toggle')"
    >
      <span class="notice-step__index">2</span>
      <span class="notice-step__heading">
        <strong>通知设置</strong>
        <small>{{ disabled ? '导入成绩后可设置' : '确认标题、日期和展示内容' }}</small>
      </span>
      <font-awesome-icon
        class="notice-step__chevron"
        :class="{ 'is-expanded': expanded }"
        :icon="['solid', 'chevron-down']"
      />
    </button>

    <div v-show="expanded && !disabled" class="notice-step__body">
      <div class="notice-settings__field">
        <label for="score-notice-title">通知标题</label>
        <el-input
          id="score-notice-title"
          v-model="store.title"
          maxlength="28"
          placeholder="输入通知标题"
        />
      </div>

      <div class="notice-settings__grid">
        <div class="notice-settings__field">
          <label>通知日期</label>
          <el-date-picker
            v-model="store.noticeDate"
            type="date"
            value-format="YYYY-MM-DD"
            format="YYYY-MM-DD"
            :clearable="false"
            placeholder="通知日期"
          />
        </div>
        <div class="notice-settings__field">
          <label>展示内容</label>
          <el-segmented
            :model-value="store.mode"
            :options="[
              { label: '等级', value: ScoreNoticeModeEnum.Grade },
              { label: '分数', value: ScoreNoticeModeEnum.Score, disabled: !canUseScoreMode }
            ]"
            @change="handleModeChange"
          />
        </div>
      </div>

      <button
        class="notice-settings__appearance-toggle"
        type="button"
        :aria-expanded="appearanceExpanded"
        @click="appearanceExpanded = !appearanceExpanded"
      >
        <span><font-awesome-icon :icon="['solid', 'font']" /> 外观设置</span>
        <span>
          {{ handwriteFontName || '默认手写字体' }}
          <font-awesome-icon
            :class="{ 'is-expanded': appearanceExpanded }"
            :icon="['solid', 'chevron-down']"
          />
        </span>
      </button>

      <div v-show="appearanceExpanded" class="notice-settings__appearance">
        <div>
          <strong>学生姓名手写字体</strong>
          <small>仅影响通知图片中的学生姓名</small>
        </div>
        <el-button
          size="small"
          :loading="handwriteFontApplying"
          @click="emit('chooseHandwriteFont')"
        >
          {{ handwriteFontApplying ? '应用中' : '更换字体' }}
        </el-button>
        <el-button
          v-if="hasCustomHandwriteFont"
          size="small"
          text
          @click="emit('clearHandwriteFont')"
        >
          恢复默认
        </el-button>
      </div>

      <div class="notice-settings__footer">
        <span>左侧预览会实时更新</span>
        <el-button type="primary" @click="emit('continue')">
          处理学生评语
          <font-awesome-icon :icon="['solid', 'arrow-right']" />
        </el-button>
      </div>
    </div>
  </section>
</template>

<style scoped lang="scss">
.notice-step {
  padding: 15px 18px;
  border-bottom: 1px solid var(--el-border-color-light);
}
.notice-step.is-disabled {
  background: var(--el-fill-color-extra-light);
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
.notice-step__head:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}
.notice-step__head:focus-visible,
.notice-settings__appearance-toggle:focus-visible {
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
  color: var(--el-text-color-secondary);
  font-size: 11px;
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
  margin-top: 14px;
}
.notice-settings__field {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 6px;
}
.notice-settings__field label {
  color: var(--el-text-color-regular);
  font-size: 12px;
  font-weight: 600;
}
.notice-settings__grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 158px;
  gap: 10px;
  margin-top: 11px;
}
.notice-settings__grid :deep(.el-date-editor),
.notice-settings__grid :deep(.el-segmented) {
  width: 100%;
}
.notice-settings__appearance-toggle {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  margin-top: 12px;
  padding: 9px 10px;
  color: var(--el-text-color-regular);
  font-size: 12px;
  background: var(--el-fill-color-lighter);
  border: 1px solid var(--el-border-color-light);
  border-radius: 6px;
  cursor: pointer;
}
.notice-settings__appearance-toggle span {
  display: inline-flex;
  align-items: center;
  gap: 7px;
}
.notice-settings__appearance-toggle span:last-child {
  min-width: 0;
  color: var(--el-text-color-secondary);
}
.notice-settings__appearance-toggle span:last-child svg {
  flex: 0 0 auto;
  font-size: 10px;
  transition: transform 0.18s ease;
}
.notice-settings__appearance-toggle span:last-child svg.is-expanded {
  transform: rotate(180deg);
}
.notice-settings__appearance {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 10px 3px 2px;
}
.notice-settings__appearance > div {
  display: flex;
  flex: 1;
  min-width: 0;
  flex-direction: column;
  gap: 2px;
}
.notice-settings__appearance strong {
  overflow: hidden;
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.notice-settings__appearance small {
  color: var(--el-text-color-secondary);
  font-size: 10px;
}
.notice-settings__appearance .el-button {
  flex: 0 0 auto;
  margin-left: 0;
}
.notice-settings__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 13px;
  padding-top: 12px;
  border-top: 1px solid var(--el-border-color-lighter);
}
.notice-settings__footer > span {
  color: var(--el-text-color-secondary);
  font-size: 11px;
}
.notice-settings__footer .el-button svg {
  margin-left: 5px;
}
</style>
