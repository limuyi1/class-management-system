<template>
  <div v-if="!store.isDataReady" class="global-loading">
    <template v-if="store.initError">
      <font-awesome-icon icon="triangle-exclamation" class="loading-icon error-icon" />
      <p class="loading-title">数据加载失败</p>
      <p class="loading-detail">{{ store.initError }}</p>
      <el-button type="primary" @click="retryLoad">重试</el-button>
    </template>
    <template v-else>
      <font-awesome-icon icon="spinner" spin class="loading-icon" />
      <p>正在加载数据...</p>
    </template>
  </div>
  <router-view v-else />
</template>

<script setup lang="ts">
import { useDataSourceStore } from '@/stores/data-source'

const store = useDataSourceStore()

const retryLoad = () => {
  window.location.reload()
}
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

.error-icon {
  color: #f56c6c;
}

.loading-title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: #1f2937;
}

.loading-detail {
  max-width: 480px;
  margin: 0;
  font-size: 13px;
  color: #909399;
  text-align: center;
}
</style>
