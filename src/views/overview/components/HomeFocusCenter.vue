<script setup lang="ts">
/** 学生观察站 — 以分组标签页展示四类关注学生，并处理空态与展开状态 */
import { computed, reactive, watchEffect } from 'vue'

import OverviewFocusGroupPanel from '@/views/overview/components/focus/OverviewFocusGroupPanel.vue'

import type { DashboardFocusGroupType, OverviewDashboardStageType } from '@/types/HomeDashboard'

interface Props {
  /** 四类学生观察分组：立即关注、值得鼓励、中段变化、波动观察 */
  focusGroups: DashboardFocusGroupType[]
  /** 当前已完成的有效单元数，用于判断趋势分析是否具备最基本的数据基础 */
  completedUnitCount: number
  /** 总览页当前数据阶段，用于展示更准确的空态说明 */
  stage: OverviewDashboardStageType
}

const props = defineProps<Props>()

const emit = defineEmits<{
  /** 点击学生时触发，打开趋势分析抽屉 */
  select: [name: string]
}>()

/** 内部状态：当前激活分组 key、各分组的展开状态记录 */
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
/** 空态说明文案，按页面阶段与数据充足程度动态生成 */
const emptyDescription = computed(() =>
  props.stage === 'noUnits'
    ? '还没有设置单元，设置并录入成绩后会生成学生观察分组'
    : props.stage === 'noScores'
      ? '单元已设置但暂无成绩，录入成绩后会生成学生观察分组'
      : shouldShowInsufficientDataEmpty.value
        ? '当前仅有 1 个单元数据，暂无法进行趋势分析，请至少录入 2 个单元后再查看'
        : '暂无符合条件的学生'
)

/** 当前激活分组是否处于展开状态，展开时撑满剩余高度 */
const shouldFillRemainingSpace = computed(() =>
  Boolean(state.expandedByGroup[state.activeGroupKey])
)

/** 当前激活分组对应的语义色调，用于给卡片边框和标题着色 */
const activeGroupTone = computed(() => {
  return props.focusGroups.find((group) => group.key === state.activeGroupKey)?.tone || 'info'
})

/**
 * 记录某个分组的展开状态，供父级判断是否需要撑满剩余空间。
 *
 * @param groupKey 分组 key
 * @param expanded 是否展开
 */
const handleExpandChange = (groupKey: string, expanded: boolean) => {
  state.expandedByGroup[groupKey] = expanded
}

// 同步分组数据变化：重置失效的激活分组与展开状态，避免残留脏状态
watchEffect(() => {
  const visibleGroup = props.focusGroups.find((group) => group.sections.length > 0)

  if (!visibleGroup) {
    state.activeGroupKey = ''
    state.expandedByGroup = {}
    return
  }

  if (
    !props.focusGroups.some(
      (group) => group.key === state.activeGroupKey && group.sections.length > 0
    )
  ) {
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
  <el-card
    class="focus-center-card"
    :class="[`is-${activeGroupTone}`, { 'is-expanded': shouldFillRemainingSpace }]"
  >
    <div class="focus-header">
      <div class="focus-title">
        <font-awesome-icon :icon="['solid', 'binoculars']" />
        <span>学生观察站</span>
      </div>
    </div>

    <!-- 分组标签页：存在可见分组时展示 -->
    <el-tabs v-if="hasVisibleItems()" v-model="state.activeGroupKey" class="focus-tabs">
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

    <!-- 无任何可见分组时的整体空态 -->
    <el-empty v-else :image-size="56" :description="emptyDescription"></el-empty>
  </el-card>
</template>

<style scoped lang="scss">
.focus-center-card {
  --focus-main: #2563eb;
  --focus-soft: color-mix(in srgb, var(--focus-main) 7%, #ffffff);

  min-height: 0;
  max-height: 100%;
  overflow: hidden;
  border: 1px solid color-mix(in srgb, var(--focus-main) 14%, var(--border-muted));
  border-radius: 14px;
  box-shadow: var(--shadow-card);

  :deep(.el-card__body) {
    min-height: 0;
    display: flex;
    flex-direction: column;
    box-sizing: border-box;
  }
}

.focus-center-card.is-danger {
  --focus-main: #dc2626;
}

.focus-center-card.is-success {
  --focus-main: #059669;
}

.focus-center-card.is-info {
  --focus-main: #2563eb;
}

.focus-center-card.is-warning {
  --focus-main: #d97706;
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
  color: var(--focus-main);
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
    background: var(--focus-soft);
    color: var(--focus-main);
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
