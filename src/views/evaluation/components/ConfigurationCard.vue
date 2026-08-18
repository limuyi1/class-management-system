<script setup lang="ts">
/**
 * 预览与导出配置卡片
 * 提供缩放、页面、边距、卡片尺寸、字体等评语预览与导出参数的快捷设置。
 */
import { computed, ref } from 'vue'

import { useConfigurationStore } from '@/stores/configuration'
import type { EvaluationTableAlignType, PreviewModeType } from '@/types/Configuration'

const store = useConfigurationStore()

const activeNames = ref<string[]>([])
const expanded = ref(false)
const alignOptions: Array<{ label: string; value: EvaluationTableAlignType }> = [
  { label: '靠左', value: 'left' },
  { label: '居中', value: 'center' },
  { label: '靠右', value: 'right' }
]
const previewOptions: Array<{ label: string; value: PreviewModeType }> = [
  { label: '适应窗口', value: 'fit' },
  { label: '50%', value: '50' },
  { label: '75%', value: '75' },
  { label: '100%', value: '100' },
  { label: '125%', value: '125' }
]

const summaryText = computed(() => {
  const cardSizeText = `卡片 ${store.evaluationCardWidth}×${store.evaluationCardHeight}mm`
  const marginText = `边距 ${store.marginX}/${store.marginY}mm`
  const alignText =
    alignOptions.find((item) => item.value === store.evaluationTableAlign)?.label || '靠左'
  const pageNumberText = store.showEvaluationPageNumber ? '显示页码' : '隐藏页码'
  return `${cardSizeText} / ${marginText} / 表格${alignText} / ${pageNumberText}`
})

/**
 * 整体字号变化时联动刷新相关字号。
 *
 * @param fontSize 新的整体字号
 */
const fontChange = (fontSize?: number) => {
  if (fontSize) {
    store.fontSizeChange(fontSize)
  }
}

/** 切换高级配置的展开/收起状态 */
const toggleExpanded = () => {
  expanded.value = !expanded.value
}
</script>

<template>
  <div class="config-panel">
    <button class="config-summary" type="button" @click="toggleExpanded">
      <span class="summary-main">
        <span class="summary-title">
          <font-awesome-icon :icon="['solid', 'sliders']" />
          预览与导出设置
        </span>
        <span class="summary-text">{{ summaryText }}</span>
      </span>
      <font-awesome-icon
        class="summary-arrow"
        :class="{ expanded }"
        :icon="['solid', 'chevron-down']"
      />
    </button>

    <div v-show="expanded" class="config-body config-body--basic">
      <div class="config-grid-panel config-grid-panel--basic">
        <div class="config-item config-item--shrink">
          <label>预览缩放</label>
          <el-select v-model="store.previewMode" placeholder="选择" style="width: 100%">
            <el-option
              v-for="item in previewOptions"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
        </div>
        <div class="config-item config-item--shrink">
          <label>页面</label>
          <el-select v-model="store.pageType" placeholder="选择" style="width: 100%">
            <el-option v-for="item in store.pageTypeList" :key="item" :label="item" :value="item" />
          </el-select>
        </div>
        <div class="config-item config-item--wide">
          <label>落款名</label>
          <el-input
            style="width: 100%"
            v-model="store.inscribe"
            show-word-limit
            :minlength="1"
            :maxlength="6"
            placeholder="请输入"
          />
        </div>
      </div>
    </div>

    <div v-show="expanded" class="config-body config-body--advanced">
      <div class="config-grid-panel config-grid-panel--bottom">
        <div class="config-item">
          <label>表格位置</label>
          <el-select
            v-model="store.evaluationTableAlign"
            placeholder="选择"
            size="small"
            style="width: 100%"
          >
            <el-option
              v-for="item in alignOptions"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
        </div>
        <div class="config-item">
          <label>横向边距(mm)</label>
          <el-input-number
            v-model="store.marginX"
            style="width: 100%"
            size="small"
            :min="0"
            :max="40"
            :step="0.5"
            :precision="1"
          />
        </div>
        <div class="config-item">
          <label>纵向边距(mm)</label>
          <el-input-number
            v-model="store.marginY"
            style="width: 100%"
            size="small"
            :min="0"
            :max="40"
            :step="0.5"
            :precision="1"
          />
        </div>
      </div>

      <div class="config-grid-panel config-grid-panel--bottom">
        <div class="config-item">
          <label>卡片宽度(mm)</label>
          <el-input-number
            v-model="store.evaluationCardWidth"
            style="width: 100%"
            size="small"
            :min="40"
            :max="160"
            :step="1"
            :precision="0"
          />
        </div>
        <div class="config-item">
          <label>卡片高度(mm)</label>
          <el-input-number
            v-model="store.evaluationCardHeight"
            style="width: 100%"
            size="small"
            :min="40"
            :max="160"
            :step="1"
            :precision="0"
          />
        </div>
        <div class="config-item config-item--switch">
          <label>页码</label>
          <div class="switch-field">
            <el-switch
              v-model="store.showEvaluationPageNumber"
              inline-prompt
              active-text="显示"
              inactive-text="隐藏"
            />
          </div>
        </div>
      </div>

      <el-collapse v-model="activeNames" class="font-collapse">
        <el-collapse-item name="font" title="字体大小">
          <div class="config-grid">
            <div class="config-item">
              <label>整体</label>
              <el-input-number
                style="width: 100%"
                v-model="store.fontSize"
                :min="12"
                :max="22"
                size="small"
                @change="fontChange"
              />
            </div>
            <div class="config-item">
              <label>问候</label>
              <el-input-number
                style="width: 100%"
                v-model="store.salutationFontSize"
                :min="12"
                :max="22"
                size="small"
              />
            </div>
            <div class="config-item">
              <label>正文</label>
              <el-input-number
                style="width: 100%"
                v-model="store.textFontSize"
                :min="12"
                :max="22"
                size="small"
              />
            </div>
            <div class="config-item">
              <label>章</label>
              <el-input-number
                style="width: 100%"
                v-model="store.sealFontSize"
                :min="12"
                :max="22"
                size="small"
              />
            </div>
            <div class="config-item">
              <label>班主任</label>
              <el-input-number
                style="width: 100%"
                v-model="store.classTeacherFontSize"
                :min="12"
                :max="22"
                size="small"
              />
            </div>
            <div class="config-item">
              <label>落款</label>
              <el-input-number
                style="width: 100%"
                v-model="store.inscribeFontSize"
                :min="12"
                :max="22"
                size="small"
              />
            </div>
          </div>
        </el-collapse-item>
      </el-collapse>
    </div>
  </div>
</template>

<style scoped lang="scss">
.config-panel {
  background: #fff;
  border-radius: 10px;
  border: 1px solid #e7edf5;
  box-shadow: 0 2px 8px rgba(15, 23, 42, 0.05);
  overflow: hidden;
}

.config-summary {
  width: 100%;
  padding: 10px 12px;
  border: none;
  background: linear-gradient(180deg, #fbfdff 0%, #f6faff 100%);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  text-align: left;
  cursor: pointer;
}

.summary-main {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.summary-title {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 600;
  color: #1e293b;
}

.summary-text {
  font-size: 11px;
  color: #64748b;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.summary-arrow {
  font-size: 12px;
  color: #64748b;
  transition: transform 0.2s ease;

  &.expanded {
    transform: rotate(180deg);
  }
}

.config-body {
  padding: 10px 12px;
  border-top: 1px solid #eef2f7;
}

.config-body--basic {
  padding-bottom: 8px;
}

.config-body--advanced {
  padding-top: 8px;
  background: #fbfdff;
}

.config-grid-panel {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px 8px;
  margin-bottom: 10px;
}

.config-grid-panel--basic {
  grid-template-columns: minmax(92px, 0.9fr) minmax(84px, 0.8fr) minmax(132px, 1.5fr);
  margin-bottom: 0;
}

.config-grid-panel--bottom {
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 6px;
  margin-top: -2px;
  margin-bottom: 12px;
}

.config-grid-panel--bottom .config-item {
  label {
    margin-bottom: 2px;
    font-size: 10px;
    line-height: 1.1;
  }
}

.config-item {
  min-width: 0;

  label {
    display: block;
    margin-bottom: 4px;
    font-size: 11px;
    color: #64748b;
  }

  :deep(.el-input-number) {
    width: 100%;
  }
}

.config-item--shrink {
  min-width: 0;
}

.config-item--wide {
  min-width: 0;
}

.config-item--switch {
  min-width: 88px;
}

.switch-field {
  min-height: 32px;
  display: flex;
  align-items: center;
}

.font-collapse {
  border: none;

  :deep(.el-collapse-item__header) {
    font-size: 12px;
    color: #64748b;
    background: #f8fafc;
    border-radius: 6px;
    padding: 0 10px;
    height: 32px;
    line-height: 32px;
  }

  :deep(.el-collapse-item__wrap) {
    border: none;
  }

  :deep(.el-collapse-item__content) {
    padding: 8px 0;
  }
}

.config-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;

  .config-item {
    label {
      display: block;
      margin-bottom: 3px;
      font-size: 11px;
      color: #64748b;
    }
  }
}
</style>
