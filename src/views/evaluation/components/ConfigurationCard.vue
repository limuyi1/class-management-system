<script setup lang="ts">
import { reactive } from 'vue'
import { storeToRefs } from 'pinia'

import { exportPDF } from '@/untils/pdfUntil'

import { useConfigurationStore } from '@/stores/configuration'

const store = useConfigurationStore()
const { data: formData } = storeToRefs(store)

const activeNames = reactive([])

const printFun = () => {
  const doms = document.getElementsByClassName('evaluation-card--table__wrapper')
  exportPDF(doms, formData.value.pageType)
}

const fontChange = (fontSize: number) => {
  store.fontSizeChange(fontSize)
}
</script>

<template>
  <el-card class="configuration-card__wrapper" shadow="hover">
    <template #header>
      <div class="configuration-card--header">
        <span class="header-title">
          <font-awesome-icon :icon="['solid', 'sliders']" />
          配置设置
        </span>
        <el-tooltip effect="dark" content="导出PDF" placement="top">
          <el-button type="primary" size="small" circle @click="printFun">
            <font-awesome-icon :icon="['solid', 'print']" />
          </el-button>
        </el-tooltip>
      </div>
    </template>
    <el-form ref="form" label-position="top" :model="formData">
      <el-collapse class="configuration-collapse__wrapper" v-model="activeNames">
        <el-collapse-item title="字体大小" name="configuration">
          <div class="config-grid">
            <div class="config-item">
              <label>整体字号</label>
              <el-input-number
                style="width: 100%"
                v-model="formData.fontSize"
                :min="12"
                :max="22"
                size="small"
                @change="fontChange"
              ></el-input-number>
            </div>
            <div class="config-item">
              <label>问候语</label>
              <el-input-number
                style="width: 100%"
                v-model="formData.salutationFontSize"
                :min="12"
                :max="22"
                size="small"
              ></el-input-number>
            </div>
            <div class="config-item">
              <label>正文</label>
              <el-input-number
                style="width: 100%"
                v-model="formData.textFontSize"
                :min="12"
                :max="22"
                size="small"
              ></el-input-number>
            </div>
            <div class="config-item">
              <label>学校章</label>
              <el-input-number
                style="width: 100%"
                v-model="formData.sealFontSize"
                :min="12"
                :max="22"
                size="small"
              ></el-input-number>
            </div>
            <div class="config-item">
              <label>班主任</label>
              <el-input-number
                style="width: 100%"
                v-model="formData.classTeacherFontSize"
                :min="12"
                :max="22"
                size="small"
              ></el-input-number>
            </div>
            <div class="config-item">
              <label>落款</label>
              <el-input-number
                style="width: 100%"
                v-model="formData.inscribeFontSize"
                :min="12"
                :max="22"
                size="small"
              ></el-input-number>
            </div>
          </div>
        </el-collapse-item>
      </el-collapse>

      <div class="form-row">
        <div class="form-item">
          <label>页面类型</label>
          <el-select v-model="formData.pageType" placeholder="请选择" style="width: 100%">
            <el-option
              v-for="item in formData.pageTypeList"
              :key="item"
              :label="item"
              :value="item"
            />
          </el-select>
        </div>
      </div>

      <div class="form-row">
        <div class="form-item">
          <label>落款名称</label>
          <el-input
            style="width: 100%"
            v-model="formData.inscribe"
            size="large"
            show-word-limit
            :minlength="1"
            :maxlength="6"
            placeholder="请输入落款"
          ></el-input>
        </div>
      </div>
    </el-form>
  </el-card>
</template>

<style scoped lang="scss">
.configuration-card__wrapper {
  margin-bottom: 12px;
  border-radius: 10px;

  .configuration-card--header {
    display: flex;
    align-items: center;
    justify-content: space-between;

    .header-title {
      display: flex;
      align-items: center;
      gap: 6px;
      font-weight: 600;
      font-size: 14px;
      color: #334155;

      svg {
        color: var(--theme-primary);
        font-size: 15px;
      }
    }
  }

  .configuration-collapse__wrapper {
    margin-bottom: 12px;
    border: none;

    :deep(.el-collapse-item__header) {
      font-weight: 500;
      font-size: 13px;
      border-radius: 6px;
      background: #f8fafc;
    }

    :deep(.el-collapse-item__wrap) {
      border: none;
    }

    .config-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 10px;
      padding: 6px 0;

      .config-item {
        label {
          display: block;
          margin-bottom: 4px;
          font-size: 11px;
          color: #64748b;
        }
      }
    }
  }

  .form-row {
    margin-bottom: 10px;

    .form-item {
      label {
        display: block;
        margin-bottom: 4px;
        font-size: 12px;
        font-weight: 500;
        color: #475569;
      }
    }
  }
}
</style>
