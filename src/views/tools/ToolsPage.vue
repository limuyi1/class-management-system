<script setup lang="ts">
import { useRouter } from 'vue-router'

import PageHeader from '@/components/PageHeader.vue'
import { toolItems, type ToolItemType } from '@/views/tools/constants/tools'

const router = useRouter()

function openTool(tool: ToolItemType): void {
  if (tool.status !== 'available') return

  if (tool.openInNewTab) {
    const targetUrl = router.resolve(tool.path).href
    window.open(targetUrl, '_blank', 'noopener,noreferrer')
    return
  }

  router.push(tool.path)
}

function resolveToolHref(tool: ToolItemType): string {
  return router.resolve(tool.path).href
}
</script>

<template>
  <div class="tools-page app-page-shell">
    <page-header :icon="['solid', 'toolbox']" title="工具" subtitle="选择一个工具开始使用">
    </page-header>

    <div class="tools-grid">
      <template v-for="tool in toolItems" :key="tool.id">
        <a
          v-if="tool.openInNewTab"
          class="tool-card"
          :href="tool.status === 'available' ? resolveToolHref(tool) : undefined"
          :target="tool.status === 'available' ? '_blank' : undefined"
          :rel="tool.status === 'available' ? 'noopener noreferrer' : undefined"
          :class="{ disabled: tool.status !== 'available', secondary: tool.tone === 'secondary' }"
          @click.prevent="openTool(tool)"
        >
          <span class="tool-card__icon">
            <font-awesome-icon :icon="['solid', tool.icon]" />
          </span>
          <span class="tool-card__content">
            <span class="tool-card__header">
              <strong>{{ tool.name }}</strong>
              <em>{{
                tool.tone === 'secondary'
                  ? '素材管理'
                  : tool.status === 'available'
                    ? '已上线'
                    : '规划中'
              }}</em>
            </span>
            <span v-if="tool.openInNewTab" class="tool-card__badge">新页签打开</span>
            <span class="tool-card__description">{{ tool.description }}</span>
          </span>
          <span class="tool-card__arrow">
            <font-awesome-icon :icon="['solid', 'chevron-right']" />
          </span>
        </a>
        <button
          v-else
          class="tool-card"
          type="button"
          :class="{ disabled: tool.status !== 'available', secondary: tool.tone === 'secondary' }"
          @click="openTool(tool)"
        >
          <span class="tool-card__icon">
            <font-awesome-icon :icon="['solid', tool.icon]" />
          </span>
          <span class="tool-card__content">
            <span class="tool-card__header">
              <strong>{{ tool.name }}</strong>
              <em>{{
                tool.tone === 'secondary'
                  ? '素材管理'
                  : tool.status === 'available'
                    ? '已上线'
                    : '规划中'
              }}</em>
            </span>
            <span v-if="tool.openInNewTab" class="tool-card__badge">新页签打开</span>
            <span class="tool-card__description">{{ tool.description }}</span>
          </span>
          <span class="tool-card__arrow">
            <font-awesome-icon :icon="['solid', 'chevron-right']" />
          </span>
        </button>
      </template>
    </div>
  </div>
</template>

<style scoped lang="scss">
.tools-page {
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.tools-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 12px;
}

.tool-card {
  display: flex;
  align-items: center;
  gap: 14px;
  min-height: 108px;
  padding: 16px;
  text-align: left;
  color: #1f2937;
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.06);
  cursor: pointer;
  transition:
    border-color 0.2s,
    box-shadow 0.2s,
    transform 0.2s;
}

.tool-card:hover {
  border-color: var(--theme-menu-active);
  box-shadow: 0 12px 28px rgba(15, 23, 42, 0.1);
  transform: translateY(-1px);
}

.tool-card.disabled {
  cursor: not-allowed;
  opacity: 0.62;
}

.tool-card.secondary {
  min-height: 96px;
  background: #fbfdff;
  box-shadow: 0 6px 18px rgba(15, 23, 42, 0.035);
}

.tool-card.secondary .tool-card__icon {
  color: #64748b;
  background: #f1f5f9;
}

.tool-card.secondary .tool-card__header em {
  color: #64748b;
  background: #f8fafc;
}

.tool-card__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 46px;
  height: 46px;
  flex-shrink: 0;
  color: var(--theme-menu-active);
  background: var(--theme-menu-active-bg);
  border-radius: 8px;
  font-size: 20px;
}

.tool-card__content {
  min-width: 0;
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 8px;
}

.tool-card__header {
  display: flex;
  align-items: center;
  gap: 8px;
}

.tool-card__header strong {
  font-size: 16px;
  font-weight: 600;
}

.tool-card__header em {
  padding: 2px 7px;
  color: var(--theme-menu-active);
  background: var(--theme-menu-active-bg);
  border-radius: 999px;
  font-size: 12px;
  font-style: normal;
}

.tool-card__badge {
  display: inline-flex;
  align-self: flex-start;
  padding: 2px 8px;
  color: #0f766e;
  background: #ecfeff;
  border: 1px solid #a5f3fc;
  border-radius: 999px;
  font-size: 12px;
}

.tool-card__description {
  color: #6b7280;
  font-size: 13px;
  line-height: 1.5;
}

.tool-card__arrow {
  color: #9ca3af;
  flex-shrink: 0;
}
</style>
