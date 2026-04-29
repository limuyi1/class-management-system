<script setup lang="ts">
import PageHeader from '@/components/PageHeader.vue'
import PaperLayoutTool from '@/views/tools/components/PaperLayoutTool.vue'
</script>

<template>
  <div class="tools-page app-page-shell">
    <page-header :icon="['solid', 'toolbox']" title="工具" subtitle="试卷图片排版与导出">
    </page-header>

    <paper-layout-tool />
  </div>
</template>

<style scoped lang="scss">
.tools-page {
  display: flex;
  flex-direction: column;
  min-height: 0;
  gap: 10px;
}
</style>
