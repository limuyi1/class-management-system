<template>
  <div v-if="!store.isInitialLoading" class="global-loading">
    <font-awesome-icon icon="spinner" spin class="loading-icon" />
    <p>正在加载数据...</p>
  </div>
  <router-view v-else />
</template>

<script setup lang="ts">
import { useDataSourceStore } from '@/stores/data-source'

const store = useDataSourceStore()
</script>

<style scoped>
.global-loading {
  position: fixed;
  inset: 0;
  background: #fff;
  color: #6366f1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  z-index: 9999;
}

.loading-icon {
  font-size: 32px;
}
</style>
