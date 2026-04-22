<script setup lang="ts">
interface Props {
  icon: string[]
  title: string
  subtitle: string
}
defineProps<Props>()
</script>

<template>
  <div class="page-header">
    <div class="header-left">
      <div class="header-icon">
        <font-awesome-icon :icon="icon" />
      </div>
      <div class="header-text">
        <h2>{{ title }}</h2>
        <p>{{ subtitle }}</p>
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
