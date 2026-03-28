<script setup lang="ts">
import { ref } from 'vue'
import { storeToRefs } from 'pinia'

import { useConfigurationStore } from '@/stores/configuration'

const store = useConfigurationStore()
const { data: formData } = storeToRefs(store)

const activeNames = ref<string[]>([])

const fontChange = (fontSize?: number) => {
  if (fontSize) {
    store.fontSizeChange(fontSize)
  }
}
</script>

<template>
  <div class="config-panel">
    <div class="config-header">
      <span class="header-title">
        <font-awesome-icon :icon="['solid', 'sliders']" />
        配置
      </span>
    </div>

    <div class="config-body">
      <div class="config-row">
        <div class="config-item">
          <label>页面</label>
          <el-select v-model="formData.pageType" placeholder="选择" style="width: 100%">
            <el-option
              v-for="item in formData.pageTypeList"
              :key="item"
              :label="item"
              :value="item"
            />
          </el-select>
        </div>
        <div class="config-item full">
          <label>落款名</label>
          <el-input
            style="width: 100%"
            v-model="formData.inscribe"
            show-word-limit
            :minlength="1"
            :maxlength="6"
            placeholder="请输入"
          />
        </div>
      </div>

      <el-collapse v-model="activeNames" class="font-collapse">
        <el-collapse-item name="font" title="字体大小">
          <div class="config-grid">
            <div class="config-item">
              <label>整体</label>
              <el-input-number
                style="width: 100%"
                v-model="formData.fontSize"
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
                v-model="formData.salutationFontSize"
                :min="12"
                :max="22"
                size="small"
              />
            </div>
            <div class="config-item">
              <label>正文</label>
              <el-input-number
                style="width: 100%"
                v-model="formData.textFontSize"
                :min="12"
                :max="22"
                size="small"
              />
            </div>
            <div class="config-item">
              <label>章</label>
              <el-input-number
                style="width: 100%"
                v-model="formData.sealFontSize"
                :min="12"
                :max="22"
                size="small"
              />
            </div>
            <div class="config-item">
              <label>班主任</label>
              <el-input-number
                style="width: 100%"
                v-model="formData.classTeacherFontSize"
                :min="12"
                :max="22"
                size="small"
              />
            </div>
            <div class="config-item">
              <label>落款</label>
              <el-input-number
                style="width: 100%"
                v-model="formData.inscribeFontSize"
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
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  overflow: hidden;
}

.config-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  background: var(--theme-gradient);
  color: #fff;
  display: flex;
  justify-content: space-between;
  align-items: center;

  .header-title {
    display: flex;
    align-items: center;
    gap: 6px;
    font-weight: 600;
    font-size: 13px;

    svg {
      font-size: 13px;
    }
  }
}

.config-body {
  padding: 10px 12px;
}

.config-row {
  display: flex;
  gap: 8px;
  margin-bottom: 10px;

  .config-item {
    flex: 1;
    min-width: 0;

    &.full {
      flex: 2;
    }

    label {
      display: block;
      margin-bottom: 3px;
      font-size: 11px;
      color: #64748b;
    }
  }
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
