<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'

import PageHeader from '@/components/PageHeader.vue'
import PaperLayoutTool from '@/views/tools/components/PaperLayoutTool.vue'

const router = useRouter()
const fullscreen = ref(false)

function backToTools(): void {
  router.push('/tools')
}

function toggleFullscreen(): void {
  fullscreen.value = !fullscreen.value
}

function handleKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    fullscreen.value = false
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKeydown)
})
</script>

<template>
  <div class="paper-layout-page app-page-shell" :class="{ fullscreen }">
    <page-header
      v-if="!fullscreen"
      :icon="['solid', 'file-pdf']"
      title="试卷排版"
      subtitle="多张试卷图片排版并导出 PDF"
    >
      <template #left>
        <el-tooltip content="返回工具" placement="top">
          <el-button size="small" circle aria-label="返回工具" @click="backToTools">
            <font-awesome-icon :icon="['solid', 'arrow-left']" />
          </el-button>
        </el-tooltip>
      </template>
    </page-header>

    <paper-layout-tool :fullscreen="fullscreen" @toggle-fullscreen="toggleFullscreen" />
  </div>
</template>

<style scoped lang="scss">
.paper-layout-page {
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.paper-layout-page.fullscreen {
  position: fixed;
  inset: 0;
  z-index: 2000;
  width: 100vw;
  height: 100vh;
  padding: 8px;
}
</style>
