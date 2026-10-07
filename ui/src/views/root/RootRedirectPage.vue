<script setup lang="ts">
/** 根路由重定向页 — 依据是否已导入学生数据，将用户导向概览页或工具页 */
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'

import { useDataSourceStore } from '@/stores/data-source'

const router = useRouter()
const dataSourceStore = useDataSourceStore()

onMounted(async () => {
  // 等待数据源初始化完成，避免在持久化数据尚未加载时过早判断
  await dataSourceStore.waitForInitReady()
  // 已有学生数据进入总览页，否则先引导用户前往工具页导入数据
  const targetPath = dataSourceStore.enabledData.length > 0 ? '/overview' : '/tools'
  router.replace(targetPath)
})
</script>

<template>
  <div class="root-redirect-page"></div>
</template>

<style scoped lang="scss">
.root-redirect-page {
  height: 100%;
}
</style>
