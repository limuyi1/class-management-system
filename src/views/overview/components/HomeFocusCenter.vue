<script setup lang="ts">
import { computed } from 'vue'

import OverviewFocusGroupPanel from '@/views/overview/components/focus/OverviewFocusGroupPanel.vue'

import type { DashboardFocusGroupType } from '@/types/HomeDashboard'

interface Props {
  focusGroups: DashboardFocusGroupType[]
}

const props = defineProps<Props>()

const emit = defineEmits<{
  select: [name: string]
}>()

const hasVisibleItems = () => props.focusGroups.some((group) => group.sections.length > 0)
const hasExpandedGroup = computed(() =>
  props.focusGroups.some((group) => group.sections.some((section) => section.items.length > 5))
)
</script>

<template>
  <el-card class="focus-center-card" :class="{ 'is-expanded': hasExpandedGroup }">
    <div class="focus-header">
      <div class="focus-title">
        <font-awesome-icon :icon="['solid', 'binoculars']" />
        <span>学生观察站</span>
      </div>
    </div>

    <el-tabs v-if="hasVisibleItems()" class="focus-tabs">
      <el-tab-pane
        v-for="group in focusGroups"
        :key="group.key"
        :label="group.label"
      >
        <overview-focus-group-panel
          v-if="group.sections.length"
          :group="group"
          @select="emit('select', $event)"
        />
        <el-empty v-else :image-size="44" description="暂无符合条件的学生"></el-empty>
      </el-tab-pane>
    </el-tabs>

    <el-empty v-else :image-size="56" description="暂无符合条件的学生"></el-empty>
  </el-card>
</template>

<style scoped lang="scss">
.focus-center-card {
  min-height: 0;
  max-height: 100%;
  overflow: hidden;
  border: 1px solid var(--border-muted);
  border-radius: 14px;
  box-shadow: var(--shadow-card);

  :deep(.el-card__body) {
    min-height: 0;
    display: flex;
    flex-direction: column;
    box-sizing: border-box;
  }
}

.focus-center-card.is-expanded {
  height: 100%;

  :deep(.el-card__body) {
    height: 100%;
  }
}

.focus-title {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: var(--text-primary);
  font-size: 16px;
  font-weight: 700;
}

.focus-header {
  display: flex;
  align-items: center;
  gap: 8px;
}

.focus-tabs {
  flex: 0 1 auto;
  min-height: 0;
  margin-top: 10px;
  overflow: hidden;

  :deep(.el-tabs__nav-wrap::after) {
    display: none;
  }

  :deep(.el-tabs__header) {
    margin-bottom: 10px;
  }

  :deep(.el-tabs__nav) {
    width: 100%;
    border: 1px solid var(--border-muted);
    border-radius: 10px;
    overflow: hidden;
  }

  :deep(.el-tabs__item) {
    flex: 1;
    height: 38px;
    padding: 0 14px;
    color: var(--text-secondary);
    font-size: 14px;
  }

  :deep(.el-tabs__item.is-active) {
    background: #f8fbff;
    color: #2563eb;
    font-weight: 700;
  }

  :deep(.el-tabs__active-bar) {
    display: none;
  }

  :deep(.el-tabs__content) {
    min-height: 0;
    overflow: hidden;
  }

  :deep(.el-tab-pane) {
    min-height: 0;
    overflow: hidden;
  }
}

.focus-center-card.is-expanded .focus-tabs {
  flex: 1;
  display: flex;
  flex-direction: column;

  :deep(.el-tabs__content) {
    flex: 1;
  }

  :deep(.el-tab-pane) {
    height: 100%;
  }
}
</style>
