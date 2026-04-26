<script setup lang="ts">
import { computed, reactive, watchEffect } from 'vue'

import OverviewFocusGroupPanel from '@/views/overview/components/focus/OverviewFocusGroupPanel.vue'

import type { DashboardFocusGroupType } from '@/types/HomeDashboard'

interface Props {
  /** 四类学生观察分组：立即关注、值得鼓励、中段变化、波动观察 */
  focusGroups: DashboardFocusGroupType[]
  /** 当前已完成的有效单元数，用于判断趋势分析是否具备最基本的数据基础 */
  completedUnitCount: number
}

const props = defineProps<Props>()

const emit = defineEmits<{
  /** 点击学生时触发，打开趋势分析抽屉 */
  select: [name: string]
}>()

const state = reactive({
  activeGroupKey: '',
  expandedByGroup: {} as Record<string, boolean>
})

/** 是否有任何可见的分组内容 */
const hasVisibleItems = () => props.focusGroups.some((group) => group.sections.length > 0)
/**
 * 仅有 1 个单元时，不足以支撑趋势类分析。
 * 但如果此时仍有绝对风险学生（例如临界生）可展示，就优先展示学生而不是空态提示。
 */
const shouldShowInsufficientDataEmpty = computed(
  () => props.completedUnitCount < 2 && !hasVisibleItems()
)
const emptyDescription = computed(() =>
  shouldShowInsufficientDataEmpty.value
    ? '当前仅有 1 个单元数据，暂无法进行趋势分析，请至少录入 2 个单元后再查看'
    : '暂无符合条件的学生'
)

const shouldFillRemainingSpace = computed(() => Boolean(state.expandedByGroup[state.activeGroupKey]))

const handleExpandChange = (groupKey: string, expanded: boolean) => {
  state.expandedByGroup[groupKey] = expanded
}

watchEffect(() => {
  const visibleGroup = props.focusGroups.find((group) => group.sections.length > 0)

  if (!visibleGroup) {
    state.activeGroupKey = ''
    state.expandedByGroup = {}
    return
  }

  if (!props.focusGroups.some((group) => group.key === state.activeGroupKey && group.sections.length > 0)) {
    state.activeGroupKey = visibleGroup.key
  }

  const nextExpandedByGroup = props.focusGroups.reduce<Record<string, boolean>>((result, group) => {
    result[group.key] = state.expandedByGroup[group.key] ?? false
    return result
  }, {})

  state.expandedByGroup = nextExpandedByGroup
})
</script>

<template>
  <el-card class="focus-center-card" :class="{ 'is-expanded': shouldFillRemainingSpace }">
    <div class="focus-header">
      <div class="focus-title">
        <font-awesome-icon :icon="['solid', 'binoculars']" />
        <span>学生观察站</span>
      </div>
    </div>

    <el-tabs
      v-if="hasVisibleItems()"
      v-model="state.activeGroupKey"
      class="focus-tabs"
    >
      <el-tab-pane
        v-for="group in focusGroups"
        :key="group.key"
        :name="group.key"
        :label="group.label"
      >
        <overview-focus-group-panel
          v-if="group.sections.length"
          :group="group"
          @expand-change="handleExpandChange(group.key, $event)"
          @select="emit('select', $event)"
        />
        <el-empty v-else :image-size="44" description="暂无符合条件的学生"></el-empty>
      </el-tab-pane>
    </el-tabs>

    <el-empty v-else :image-size="56" :description="emptyDescription"></el-empty>
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
