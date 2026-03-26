<script setup lang="ts">
import { ref } from 'vue'

import LabelMaintenance from '@/views/setting/components/LabelMaintenance.vue'
import UnitConfiguration from '@/views/setting/components/UnitConfiguration.vue'
import StudentInfo from '@/views/setting/components/StudentInfo.vue'

const activeTab = ref('student-info')
</script>

<template>
  <div class="setting-page">
    <el-tabs v-model="activeTab" class="setting-tabs__wrapper">
      <el-tab-pane name="student-info">
        <template #label>
          <span class="custom-tabs-label">
            <font-awesome-icon :icon="['solid', 'user']" />
            <span>学生信息</span>
          </span>
        </template>
        <div class="tab-content">
          <student-info />
        </div>
      </el-tab-pane>
      <el-tab-pane name="label-maintenance">
        <template #label>
          <span class="custom-tabs-label">
            <font-awesome-icon :icon="['solid', 'wrench']" />
            <span>标签维护</span>
          </span>
        </template>
        <div class="tab-content">
          <label-maintenance />
        </div>
      </el-tab-pane>
      <el-tab-pane name="unit-config">
        <template #label>
          <span class="custom-tabs-label">
            <font-awesome-icon :icon="['solid', 'screwdriver-wrench']" />
            <span>单元配置</span>
          </span>
        </template>
        <div class="tab-content">
          <unit-configuration />
        </div>
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<style scoped lang="scss">
.setting-page {
  height: 100%;
  padding: 8px;
  background: linear-gradient(135deg, #f5f7fa 0%, #e4e7ed 100%);
}

.setting-tabs__wrapper {
  height: 100%;
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.08);
  overflow: hidden;

  :deep(.el-tabs__header) {
    margin: 0;
    background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
    border-radius: 12px 12px 0 0;
  }

  :deep(.el-tabs__nav-wrap) {
    padding: 0 16px;
  }

  :deep(.el-tabs__item) {
    position: relative;
    height: 56px;
    line-height: 56px;
    color: rgba(255, 255, 255, 0.7);
    font-size: 15px;
    transition: all 0.3s ease;
    padding: 0 24px;

    &:hover {
      color: #fff;
    }

    &.is-active {
      color: #fff;
      font-weight: 600;
    }
  }

  :deep(.el-tabs__active-bar) {
    display: none;
  }

  :deep(.el-tabs__nav-scroll) {
    padding-left: 0;
  }

  :deep(.el-tabs__content) {
    height: calc(100% - 56px);
    padding: 0;
  }

  :deep(.el-tab-pane) {
    height: 100%;
  }
}

.tab-content {
  height: 100%;
  background-color: #fff;
  border-radius: 0 0 12px 12px;
}

.custom-tabs-label {
  display: flex;
  align-items: center;
  gap: 8px;

  svg {
    font-size: 16px;
  }
}
</style>
