<script setup lang="ts">
import LabelMaintenance from '@/views/setting/components/LabelMaintenance.vue'
import UnitConfiguration from '@/views/setting/components/UnitConfiguration.vue'
</script>

<template>
  <el-tabs class="setting-tabs__wrapper">
    <el-tab-pane>
      <template #label>
        <span class="custom-tabs-label">
          <font-awesome-icon :icon="['solid', 'database']" />
          <span>详细信息</span>
        </span>
      </template>
      详细信息
    </el-tab-pane>
    <el-tab-pane>
      <template #label>
        <span class="custom-tabs-label">
          <font-awesome-icon :icon="['solid', 'wrench']" />
          <span>标签维护</span>
        </span>
      </template>
      <label-maintenance />
    </el-tab-pane>
    <el-tab-pane>
      <template #label>
        <span class="custom-tabs-label">
          <font-awesome-icon :icon="['solid', 'screwdriver-wrench']" />
          <span>单元配置</span>
        </span>
      </template>

      <unit-configuration />
    </el-tab-pane>
  </el-tabs>
</template>

<style scoped lang="scss">
.setting-tabs__wrapper {
  height: 100%;

  .custom-tabs-label {
    display: flex;
    align-items: center;

    span {
      margin-left: 4px;
    }
  }

  :deep(.el-tabs__header) {
    margin: 0;
  }

  :deep(.el-tabs__nav-scroll) {
    padding-left: 24px;
  }

  :deep(.el-tabs__content) {
    height: 100%;
    background-color: var(--el-color-info-light-9);
    padding: 16px 24px;
  }

  :deep(.el-tab-pane) {
    height: 100%;
  }
}
</style>
