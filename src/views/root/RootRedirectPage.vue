<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'

import { useDataSourceStore } from '@/stores/data-source'

const router = useRouter()
const dataSourceStore = useDataSourceStore()

onMounted(async () => {
  await dataSourceStore.waitForInitReady()
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
