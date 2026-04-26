<script setup lang="ts">
import { computed, reactive, watchEffect } from 'vue'

import OverviewStudentRow from '@/views/overview/components/OverviewStudentRow.vue'

import type {
  DashboardFocusGroupKeyType,
  DashboardFocusGroupType,
  DashboardFocusSectionType
} from '@/types/HomeDashboard'

interface Props {
  /** 单个关注分组数据，包含多个标签区块 */
  group: DashboardFocusGroupType
}

const props = defineProps<Props>()

const emit = defineEmits<{
  expandChange: [expanded: boolean]
  select: [name: string]
}>()

/** 默认展示的学生数量，超过则显示"查看全部"按钮 */
const DEFAULT_VISIBLE_COUNT = 5

const state = reactive({
  expanded: false,
  activeSectionKey: ''
})

/**
 * 区块显示顺序映射。
 * 这里不再承担主排序职责，只在同一 priority 下提供细分顺序。
 * 例如“中段变化”“波动观察”会由同一个标签拆成两个子区块，
 * 此时仍然需要一个稳定的前后顺序，避免同优先级时出现随机感。
 */
const sectionOrderMaps: Partial<Record<DashboardFocusGroupKeyType, Record<string, number>>> = {
  middleChange: {
    middleFalling: 0,
    middleRising: 1
  },
  volatilityWatch: {
    volatilityFalling: 0,
    volatilityRising: 1
  }
}

/**
 * 区块排序以配置里的 priority 为主。
 * 这样业务想调整“立即关注”等分组顺序时，只改 dashboard 常量即可，
 * 展示层不需要再额外维护一份硬编码顺序。
 *
 * 只有当两个区块 priority 相同，才回退到分组内的细分顺序；
 * 如果仍然相同，再按人数和名称兜底，保证排序稳定。
 */
const sortedSections = computed(() => {
  const orderMap = sectionOrderMaps[props.group.key]

  return [...props.group.sections].sort((a, b) => {
    if (a.priority !== b.priority) {
      return a.priority - b.priority
    }

    if (orderMap) {
      const sectionOrderDiff =
        (orderMap[a.key] ?? Number.MAX_SAFE_INTEGER) - (orderMap[b.key] ?? Number.MAX_SAFE_INTEGER)

      if (sectionOrderDiff !== 0) {
        return sectionOrderDiff
      }
    }

    if (a.count !== b.count) {
      return b.count - a.count
    }

    return a.label.localeCompare(b.label, 'zh-CN')
  })
})

const activeSection = computed<DashboardFocusSectionType | null>(() => {
  if (!sortedSections.value.length) return null

  return (
    sortedSections.value.find((section) => section.key === state.activeSectionKey) ||
    sortedSections.value[0]
  )
})

const visibleItems = computed(() => {
  const items = activeSection.value?.items || []
  return state.expanded ? items : items.slice(0, DEFAULT_VISIBLE_COUNT)
})

const shouldShowToggle = computed(
  () => (activeSection.value?.items.length || 0) > DEFAULT_VISIBLE_COUNT
)

const toggleExpanded = () => {
  state.expanded = !state.expanded
  emit('expandChange', state.expanded)
}

const selectSection = (sectionKey: string) => {
  state.activeSectionKey = sectionKey
  if (state.expanded) {
    state.expanded = false
    emit('expandChange', false)
  }
}

watchEffect(() => {
  if (!sortedSections.value.length) {
    state.activeSectionKey = ''
    if (state.expanded) {
      state.expanded = false
      emit('expandChange', false)
    }
    return
  }

  if (!sortedSections.value.some((section) => section.key === state.activeSectionKey)) {
    state.activeSectionKey = sortedSections.value[0].key
    if (state.expanded) {
      state.expanded = false
      emit('expandChange', false)
    }
  }
})
</script>

<template>
  <div class="focus-panel" :class="{ 'is-expanded': state.expanded }">
    <div class="focus-section-tabs">
      <button
        v-for="section in sortedSections"
        :key="section.key"
        class="focus-section-tab"
        :class="[`is-${section.key}`, { 'is-active': activeSection?.key === section.key }]"
        type="button"
        @click="selectSection(section.key)"
      >
        <span>{{ section.label }}</span>
        <strong>{{ section.count }}</strong>
      </button>
    </div>

    <div v-if="activeSection" class="focus-section-meta">
      {{ activeSection.description }}
    </div>

    <el-scrollbar class="focus-scrollbar">
      <div class="focus-list">
        <overview-student-row
          v-for="item in visibleItems"
          :key="`${group.key}-${activeSection?.key}-${item.name}`"
          :item="item"
          :tone="group.tone"
          variant="panel"
          @select="emit('select', $event)"
        />
      </div>
    </el-scrollbar>

    <button v-if="shouldShowToggle" class="focus-toggle" type="button" @click="toggleExpanded">
      <span v-if="state.expanded">收起全部</span>
      <span v-else>查看全部（{{ activeSection?.count || 0 }}人）</span>
      <font-awesome-icon :icon="['solid', state.expanded ? 'angle-up' : 'angle-right']" />
    </button>
  </div>
</template>

<style scoped lang="scss">
.focus-panel {
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.focus-panel.is-expanded {
  height: 100%;
}

.focus-list {
  display: flex;
  flex-direction: column;
  gap: 0;
  padding-right: 4px;
}

.focus-section-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 8px;
}

.focus-section-tab {
  padding: 4px 8px;
  border: 1px solid #dbe5f0;
  border-radius: 999px;
  background: #ffffff;
  color: var(--text-secondary);
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  line-height: 1;
  cursor: pointer;

  strong {
    color: var(--text-primary);
    font-size: 11px;
    font-weight: 700;
  }
}

.focus-section-tab.is-active {
  border-color: #93c5fd;
  background: #eff6ff;
  color: #2563eb;
}

.focus-section-tab.is-volatilityFalling {
  border-color: #fed7aa;
  background: #fff7ed;
  color: #c2410c;
}

.focus-section-tab.is-volatilityRising {
  border-color: #a7f3d0;
  background: #ecfdf5;
  color: #047857;
}

.focus-section-meta {
  margin-bottom: 8px;
  font-size: 12px;
  line-height: 1.5;
  color: var(--text-secondary);
}

.focus-scrollbar {
  min-height: 0;
}

.focus-panel.is-expanded .focus-scrollbar {
  flex: 1;
}

.focus-toggle {
  flex-shrink: 0;
  margin-top: 8px;
  align-self: center;
  padding: 0;
  border: 0;
  background: transparent;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: #2563eb;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}

:deep(.focus-list .overview-student-row) {
  border-bottom: 1px solid #e8eef6;
}
</style>
