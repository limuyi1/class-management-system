<script setup lang="ts">
/** 工具中心页面 — 版纸排版、附件库、名单对比等功能入口 */
import { useRouter } from 'vue-router'

import PageHeader from '@/components/PageHeader.vue'
import ToolCard from '@/views/tools/components/ToolCard.vue'
import {
  toolCategories,
  toolItems,
  type ToolCategoryType,
  type ToolItemType
} from '@/views/tools/constants/tools'

/** 工具分类及其下工具项的展示分组 */
interface ToolGroupType {
  category: ToolCategoryType
  tools: ToolItemType[]
}

const router = useRouter()

/** 按分类聚合后的工具分组列表 */
const toolGroups: ToolGroupType[] = toolCategories.map((category) => ({
  category,
  tools: toolItems.filter((tool) => tool.category === category.id)
}))

/** 打开工具：需要新页签时用 window.open，否则路由内跳转 */
function openTool(tool: ToolItemType): void {
  if (tool.openInNewTab) {
    const targetUrl = router.resolve(tool.path).href
    window.open(targetUrl, '_blank', 'noopener,noreferrer')
    return
  }

  router.push(tool.path)
}

/** 解析工具路由的完整 hash 地址，供新页签链接使用 */
function resolveToolHref(tool: ToolItemType): string {
  return router.resolve(tool.path).href
}
</script>

<template>
  <div class="tools-page app-page-shell">
    <PageHeader :icon="['solid', 'toolbox']" title="工具" subtitle="按教学场景查找并使用常用工具" />

    <!-- 按分类分组展示工具入口 -->
    <div class="tool-sections">
      <section
        v-for="group in toolGroups"
        :key="group.category.id"
        class="tool-section"
        :class="`tool-section--${group.category.id}`"
      >
        <header class="tool-section__header">
          <span class="tool-section__heading">
            <h2 class="tool-section__title">{{ group.category.name }}</h2>
            <span class="tool-section__description">{{ group.category.description }}</span>
          </span>
        </header>

        <div class="tools-grid">
          <ToolCard
            v-for="tool in group.tools"
            :key="tool.id"
            :tool="tool"
            :href="resolveToolHref(tool)"
            @open="openTool"
          />
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped lang="scss">
.tools-page {
  display: flex;
  min-height: 0;
  flex-direction: column;
}

.tool-sections {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  align-items: start;
  gap: 22px;
}

.tool-section {
  --tool-category-color: #2563eb;
  --tool-category-icon-bg: #dbeafe;

  min-width: 0;
}

.tool-section--class-management {
  --tool-category-color: #0f766e;
  --tool-category-icon-bg: #ccfbf1;
}

.tool-section--documents {
  --tool-category-color: #b45309;
  --tool-category-icon-bg: #fef3c7;
}

.tool-section__header {
  display: flex;
  min-height: 47px;
  margin-bottom: 10px;
  padding-left: 10px;
  border-left: 3px solid var(--tool-category-color);
}

.tool-section__heading {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 2px;
}

.tool-section__title {
  margin: 0;
  color: #1f2937;
  font-size: 17px;
  font-weight: 650;
  line-height: 1.4;
}

.tool-section__description {
  color: #64748b;
  font-size: 13px;
  line-height: 1.4;
}

.tools-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 10px;
}

@media (max-width: 1080px) {
  .tool-sections {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 680px) {
  .tool-sections {
    grid-template-columns: 1fr;
  }
}
</style>
