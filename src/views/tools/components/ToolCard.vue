<script setup lang="ts">
/** 工具卡片 — 展示单个工具入口，支持按钮或新页签链接两种形态 */
import { computed } from 'vue'

import type { ToolItemType } from '@/views/tools/constants/tools'

/** 组件属性：工具项与解析后的链接地址 */
interface PropsType {
  tool: ToolItemType
  href: string
}

/** 组件事件：打开工具 */
interface EmitsType {
  open: [tool: ToolItemType]
}

const props = defineProps<PropsType>()
const emit = defineEmits<EmitsType>()

/** 新页签打开时渲染为链接，否则渲染为按钮 */
const elementType = computed(() => (props.tool.openInNewTab ? 'a' : 'button'))

/** 点击卡片时向外抛出打开动作 */
function handleClick(): void {
  emit('open', props.tool)
}
</script>

<template>
  <!-- 根据是否新页签打开，动态渲染为链接或按钮 -->
  <component
    :is="elementType"
    class="tool-card"
    :href="tool.openInNewTab ? href : undefined"
    :target="tool.openInNewTab ? '_blank' : undefined"
    :rel="tool.openInNewTab ? 'noopener noreferrer' : undefined"
    :type="tool.openInNewTab ? undefined : 'button'"
    @click.prevent="handleClick"
  >
    <span class="tool-card__icon" aria-hidden="true">
      <font-awesome-icon :icon="['solid', tool.icon]" />
    </span>

    <span class="tool-card__content">
      <span class="tool-card__title-row">
        <strong class="tool-card__title">{{ tool.name }}</strong>
        <span v-if="tool.openInNewTab" class="tool-card__status tool-card__status--tab">
          新页签打开
        </span>
      </span>
      <span class="tool-card__description">{{ tool.description }}</span>
    </span>

    <span class="tool-card__arrow" aria-hidden="true">
      <font-awesome-icon :icon="['solid', 'chevron-right']" />
    </span>
  </component>
</template>

<style scoped lang="scss">
.tool-card {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 84px;
  padding: 12px 14px;
  text-align: left;
  text-decoration: none;
  color: #1f2937;
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  box-shadow: 0 3px 10px rgba(15, 23, 42, 0.04);
  cursor: pointer;
  transition:
    border-color 0.2s,
    box-shadow 0.2s,
    transform 0.2s;
}

.tool-card:hover {
  border-color: var(--tool-category-color);
  box-shadow: 0 7px 18px rgba(15, 23, 42, 0.08);
  transform: translateY(-1px);
}

.tool-card:focus-visible {
  outline: 2px solid var(--tool-category-color);
  outline-offset: 2px;
}

.tool-card__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  flex-shrink: 0;
  color: var(--tool-category-color);
  background: var(--tool-category-icon-bg);
  border-radius: 8px;
  font-size: 17px;
}

.tool-card__content {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 5px;
}

.tool-card__title-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

.tool-card__title {
  font-size: 16px;
  font-weight: 600;
}

.tool-card__status {
  padding: 2px 7px;
  color: #64748b;
  background: #f1f5f9;
  border-radius: 999px;
  font-size: 12px;
}

.tool-card__status--tab {
  color: #0f766e;
  background: #ecfeff;
}

.tool-card__description {
  color: #6b7280;
  font-size: 13px;
  line-height: 1.5;
}

.tool-card__arrow {
  color: #9ca3af;
  flex-shrink: 0;
  transition:
    color 0.2s,
    transform 0.2s;
}

.tool-card:hover .tool-card__arrow {
  color: var(--tool-category-color);
  transform: translateX(2px);
}
</style>
