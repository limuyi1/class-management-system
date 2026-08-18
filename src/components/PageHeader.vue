<script setup lang="ts">
/**
 * 页面标题栏组件。
 *
 * 左侧展示图标、标题与副标题，右侧通过插槽放置操作按钮，
 * 供各业务页面统一页头样式。
 */
interface Props {
  /** FontAwesome 图标名（数组形式，如 ['solid', 'user']） */
  icon: string[]
  /** 页面标题 */
  title: string
  /** 可选副标题 */
  subtitle?: string
}
defineProps<Props>()
</script>

<template>
  <div class="page-header">
    <div class="header-left">
      <slot name="left"></slot>
      <div class="header-icon">
        <font-awesome-icon :icon="icon" />
      </div>
      <div class="header-text">
        <h2>{{ title }}</h2>
        <p v-if="subtitle">{{ subtitle }}</p>
      </div>
    </div>
    <div class="header-right">
      <slot name="right"></slot>
    </div>
  </div>
</template>

<style scoped lang="scss">
.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 10px;
  padding: 12px 16px;
  background: color-mix(in srgb, var(--el-color-primary) 8%, #ffffff);
  border: 1px solid color-mix(in srgb, var(--el-color-primary) 14%, #ffffff);
  border-radius: 12px;
  color: var(--el-text-color-primary);

  .header-left {
    display: flex;
    align-items: center;
    gap: 10px;

    :deep(.el-button) {
      background: #fff;
      border-color: var(--border-muted);
      color: var(--el-text-color-primary);

      &:hover,
      &:focus {
        border-color: var(--el-color-primary-light-5);
        color: var(--el-color-primary);
      }
    }
  }

  .header-right {
    display: flex;
    align-items: center;
    gap: 8px;

    .el-button {
      background: #fff;
      border-color: var(--border-muted);
      color: var(--el-text-color-primary);

      &:hover {
        border-color: var(--el-color-primary-light-5);
        color: var(--el-color-primary);
      }

      &:focus {
        border-color: var(--el-color-primary-light-5);
        color: var(--el-color-primary);
      }
    }
  }

  .header-icon {
    width: 34px;
    height: 34px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: color-mix(in srgb, var(--el-color-primary) 12%, #ffffff);
    border-radius: 9px;
    color: var(--el-color-primary);
    font-size: 16px;
  }

  .header-text {
    h2 {
      margin: 0 0 1px 0;
      font-size: 17px;
      font-weight: 600;
      line-height: 1.3;
    }

    p {
      margin: 0;
      font-size: 12px;
      color: var(--el-text-color-secondary);
      line-height: 1.4;
    }
  }
}
</style>
