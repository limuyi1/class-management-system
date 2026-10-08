<script setup lang="ts">
import ThemeSelector from '@/components/ThemeSelector.vue'
</script>

<template>
  <el-popover trigger="click" placement="bottom-end" width="300">
    <template #reference>
      <button type="button" class="theme-menu__trigger" aria-label="切换主题" title="切换主题">
        <font-awesome-icon :icon="['solid', 'palette']" />
      </button>
    </template>
    <ThemeSelector />
  </el-popover>
</template>

<style scoped lang="scss">
.theme-menu__trigger {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  padding: 0;
  border: 1px solid rgba(255, 255, 255, 0.5);
  border-radius: 6px;
  background: rgba(0, 0, 0, 0.12);
  color: #fff;
  font-size: 16px;
  cursor: pointer;
  &:hover {
    background: rgba(0, 0, 0, 0.2);
  }
  &:focus-visible {
    outline: 2px solid #fff;
    outline-offset: 2px;
  }
}
</style>
