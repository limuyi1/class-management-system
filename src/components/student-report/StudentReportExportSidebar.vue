<script setup lang="ts">
import { computed } from 'vue'

import type { SettingType } from '@/types/Setting'

/**
 * 学习报告导出侧边栏。
 *
 * 负责成绩范围勾选、正文内容编辑与导出设置（质量/分辨率），
 * 所有状态通过 v-model 事件交由父组件管理，本组件仅做展示与交互转发。
 */
interface Props {
  /** 可选成绩列 */
  scoreColumns: SettingType[]
  /** 已选成绩列 prop 列表 */
  selectedProps: string[]
  /** 报告正文内容 */
  content: string
  /** 正文状态 */
  contentStatus: 'idle' | 'ready' | 'dirty' | 'stale'
  /** AI 生成进行中 */
  generating: boolean
  /** 导出进行中 */
  exporting: boolean
  /** 是否允许导出 */
  canExport: boolean
  /** 正文生成来源标签文案 */
  generatorLabel: string
  /** AI 是否已配置 */
  aiConfigured: boolean
  /** 导出质量档位 */
  exportQuality: string
  /** 导出分辨率倍率 */
  exportScale: string
}

const props = defineProps<Props>()

const emit = defineEmits<{
  /** 已选成绩项变化 */
  'update:selectedProps': [value: string[]]
  /** 正文内容变化 */
  'update:content': [value: string]
  /** 导出质量变化 */
  'update:exportQuality': [value: string]
  /** 导出倍率变化 */
  'update:exportScale': [value: string]
  /** 请求应用模板正文 */
  'apply-template-content': []
  /** 请求 AI 生成正文 */
  'generate-content': []
  /** 请求导出图片 */
  export: []
}>()

/** 成绩范围选择的 v-model 双向绑定代理 */
const selectedModel = computed({
  get: () => props.selectedProps,
  set: (value: string[]) => emit('update:selectedProps', value)
})

/** 正文内容的 v-model 双向绑定代理 */
const contentModel = computed({
  get: () => props.content,
  set: (value: string) => emit('update:content', value)
})

/** 图片质量的 v-model 双向绑定代理 */
const qualityModel = computed({
  get: () => props.exportQuality,
  set: (value: string) => emit('update:exportQuality', value)
})

/** 分辨率的 v-model 双向绑定代理 */
const scaleModel = computed({
  get: () => props.exportScale,
  set: (value: string) => emit('update:exportScale', value)
})

/** 已选成绩项数量 */
const selectedCount = computed(() => props.selectedProps.length)
// 是否已全选所有成绩列
const allSelected = computed(() => {
  return props.scoreColumns.length > 0 && props.selectedProps.length === props.scoreColumns.length
})

/** 导出质量档位选项 */
const qualityOptions = [
  {
    value: 'standard',
    label: '标准',
    hint: '适合屏幕查看和日常使用'
  },
  {
    value: 'high',
    label: '高清',
    hint: '推荐导出到家校群或打印预览'
  },
  {
    value: 'ultra',
    label: '超清',
    hint: '文件更大，适合精细留档'
  }
]

/** 导出分辨率倍率选项 */
const scaleOptions = [
  {
    value: '1',
    label: '1倍'
  },
  {
    value: '2',
    label: '2倍（推荐）'
  },
  {
    value: '3',
    label: '3倍'
  }
]

/**
 * 全选 / 清空成绩列
 */
const toggleSelectAll = (): void => {
  if (allSelected.value) {
    selectedModel.value = []
    return
  }

  selectedModel.value = props.scoreColumns.map((item) => item.prop)
}
</script>

<template>
  <aside class="student-report-sidebar">
    <!-- 成绩范围选择 -->
    <section class="student-report-sidebar__card">
      <div class="student-report-sidebar__header">
        <div class="student-report-sidebar__header-main">
          <span class="student-report-sidebar__icon student-report-sidebar__icon--blue">
            <font-awesome-icon :icon="['regular', 'calendar-days']" />
          </span>
          <div>
            <h3 class="student-report-sidebar__title">成绩范围</h3>
            <p class="student-report-sidebar__description">选择要包含在报告中的阶段成绩</p>
          </div>
        </div>
        <button class="student-report-sidebar__link" type="button" @click="toggleSelectAll">
          {{ allSelected ? '清空' : '全选' }}
        </button>
      </div>

      <el-checkbox-group v-model="selectedModel" class="student-report-sidebar__checkboxes">
        <el-checkbox v-for="item in scoreColumns" :key="item.prop" :label="item.prop">
          <el-tooltip :content="item.label" placement="top" :show-after="200">
            <span class="student-report-sidebar__checkbox-label">{{ item.label }}</span>
          </el-tooltip>
        </el-checkbox>
      </el-checkbox-group>

      <div class="student-report-sidebar__footer-tip">
        已选择 {{ selectedCount }} / {{ scoreColumns.length }} 项
      </div>
    </section>

    <!-- 正文内容编辑 -->
    <section class="student-report-sidebar__card">
      <div class="student-report-sidebar__header">
        <div class="student-report-sidebar__header-main">
          <span class="student-report-sidebar__icon student-report-sidebar__icon--teal">
            <font-awesome-icon :icon="['regular', 'file-lines']" />
          </span>
          <div>
            <h3 class="student-report-sidebar__title">正文内容</h3>
            <p class="student-report-sidebar__description">默认使用模板内容，可按需 AI 生成</p>
          </div>
        </div>
      </div>

      <div class="student-report-sidebar__toolbar">
        <el-tag size="small" :type="aiConfigured ? 'success' : 'info'">
          {{ generatorLabel }}
        </el-tag>
        <div class="student-report-sidebar__toolbar-actions">
          <el-button
            class="student-report-sidebar__content-button"
            size="small"
            plain
            :disabled="!selectedCount"
            @click="emit('apply-template-content')"
          >
            <template #icon>
              <font-awesome-icon :icon="['regular', 'file-lines']" />
            </template>
            模板正文
          </el-button>
          <el-button
            v-if="aiConfigured"
            class="student-report-sidebar__content-button"
            type="primary"
            size="small"
            :loading="generating"
            :disabled="!selectedCount"
            @click="emit('generate-content')"
          >
            <template #icon>
              <font-awesome-icon :icon="['solid', 'wand-magic-sparkles']" />
            </template>
            AI 生成
          </el-button>
        </div>
      </div>

      <div v-if="contentStatus === 'stale'" class="student-report-sidebar__notice">
        成绩范围已变更，请重新生成正文后再导出。
      </div>

      <el-input
        v-model="contentModel"
        type="textarea"
        :rows="11"
        resize="none"
        placeholder="正文内容会显示在这里"
      />
    </section>

    <!-- 导出设置（PNG） -->
    <section class="student-report-sidebar__card">
      <div class="student-report-sidebar__header">
        <div class="student-report-sidebar__header-main">
          <span class="student-report-sidebar__icon student-report-sidebar__icon--violet">
            <font-awesome-icon :icon="['regular', 'image']" />
          </span>
          <div>
            <h3 class="student-report-sidebar__title">导出设置（PNG）</h3>
            <p class="student-report-sidebar__description">按设计稿布局导出高清 PNG 图片</p>
          </div>
        </div>
      </div>

      <div class="student-report-sidebar__field">
        <label class="student-report-sidebar__label">图片质量</label>
        <el-select v-model="qualityModel" class="student-report-sidebar__select">
          <el-option
            v-for="item in qualityOptions"
            :key="item.value"
            :label="item.label"
            :value="item.value"
          />
        </el-select>
        <p class="student-report-sidebar__field-hint">
          {{ qualityOptions.find((item) => item.value === exportQuality)?.hint }}
        </p>
      </div>

      <div class="student-report-sidebar__field">
        <label class="student-report-sidebar__label">分辨率</label>
        <el-select v-model="scaleModel" class="student-report-sidebar__select">
          <el-option
            v-for="item in scaleOptions"
            :key="item.value"
            :label="item.label"
            :value="item.value"
          />
        </el-select>
        <p class="student-report-sidebar__field-hint">更高分辨率会获得更清晰的图片</p>
      </div>
    </section>

    <!-- 导出按钮与提示 -->
    <button
      class="student-report-sidebar__export-button"
      type="button"
      :disabled="!canExport || exporting"
      @click="emit('export')"
    >
      <font-awesome-icon :icon="['regular', 'image']" />
      <span>{{ exporting ? '正在导出...' : '导出为 PNG' }}</span>
    </button>
    <p class="student-report-sidebar__export-hint">导出过程请勿关闭窗口</p>
  </aside>
</template>

<style scoped lang="scss">
.student-report-sidebar {
  display: flex;
  flex-direction: column;
  gap: 18px;
  min-height: 0;
}

.student-report-sidebar__card {
  padding: 18px;
  border: 1px solid rgba(208, 216, 230, 0.86);
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.9);
  box-shadow: 0 14px 34px rgba(48, 71, 102, 0.08);
}

.student-report-sidebar__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.student-report-sidebar__header-main {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

.student-report-sidebar__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border-radius: 12px;
  font-size: 15px;
}

.student-report-sidebar__icon--blue {
  color: #3b82f6;
  background: rgba(59, 130, 246, 0.12);
}

.student-report-sidebar__icon--teal {
  color: #0f766e;
  background: rgba(15, 118, 110, 0.12);
}

.student-report-sidebar__icon--violet {
  color: #6d28d9;
  background: rgba(109, 40, 217, 0.12);
}

.student-report-sidebar__title {
  margin: 0;
  color: #18212f;
  font-size: 14px;
  font-weight: 700;
}

.student-report-sidebar__description,
.student-report-sidebar__field-hint,
.student-report-sidebar__footer-tip,
.student-report-sidebar__export-hint {
  margin: 0;
  color: #6d7685;
  font-size: 12px;
  line-height: 1.7;
}

.student-report-sidebar__description {
  margin-top: 4px;
}

.student-report-sidebar__link {
  padding: 0;
  color: #2563eb;
  border: 0;
  background: transparent;
  font-size: 13px;
  cursor: pointer;
}

.student-report-sidebar__checkboxes {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  margin-top: 16px;
}

.student-report-sidebar__checkboxes :deep(.el-checkbox) {
  display: flex;
  min-height: 46px;
  margin-right: 0;
  padding: 0 12px;
  border: 1px solid rgba(214, 220, 230, 0.96);
  border-radius: 12px;
  background: #fff;
}

.student-report-sidebar__checkboxes :deep(.el-checkbox__input) {
  align-self: center;
}

.student-report-sidebar__checkboxes :deep(.el-checkbox__label) {
  display: flex;
  align-items: center;
  min-width: 0;
  color: #243041;
  font-size: 14px;
}

.student-report-sidebar__checkbox-label {
  display: inline-block;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.student-report-sidebar__footer-tip {
  margin-top: 14px;
  padding-top: 12px;
  border-top: 1px solid rgba(224, 229, 238, 0.9);
}

.student-report-sidebar__toolbar {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin: 14px 0 12px;
}

.student-report-sidebar__toolbar-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  flex: 0 0 auto;
  flex-wrap: nowrap;
  gap: 6px;
}

.student-report-sidebar__content-button {
  min-width: 86px;
  font-weight: 600;
}

.student-report-sidebar__content-button + .student-report-sidebar__content-button {
  margin-left: 0;
}

.student-report-sidebar__notice {
  margin-bottom: 12px;
  padding: 10px 12px;
  color: #9f5f17;
  background: rgba(245, 176, 65, 0.14);
  border: 1px solid rgba(245, 176, 65, 0.26);
  border-radius: 12px;
  font-size: 12px;
  line-height: 1.6;
}

.student-report-sidebar__field + .student-report-sidebar__field {
  margin-top: 14px;
}

.student-report-sidebar__label {
  display: block;
  margin-bottom: 8px;
  color: #354153;
  font-size: 13px;
  font-weight: 600;
}

.student-report-sidebar__select {
  width: 100%;
}

.student-report-sidebar__field-hint {
  margin-top: 8px;
}

.student-report-sidebar__export-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  min-height: 52px;
  color: #fff;
  border: 0;
  border-radius: 14px;
  background: linear-gradient(135deg, #3c82f6 0%, #215dd8 100%);
  box-shadow: 0 16px 32px rgba(37, 99, 235, 0.24);
  font-size: 16px;
  font-weight: 700;
  cursor: pointer;
}

.student-report-sidebar__export-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  box-shadow: none;
}

.student-report-sidebar__export-hint {
  text-align: center;
}

@media (max-width: 1200px) {
  .student-report-sidebar__checkboxes {
    grid-template-columns: 1fr;
  }
}
</style>
