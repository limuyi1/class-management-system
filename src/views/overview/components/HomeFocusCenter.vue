<script setup lang="ts">
import { computed, reactive, watchEffect } from 'vue'

import OverviewStudentRow from '@/views/overview/components/OverviewStudentRow.vue'

import type {
  DashboardFocusGroupKeyType,
  DashboardFocusGroupType,
  DashboardFocusSectionType
} from '@/types/HomeDashboard'

interface Props {
  focusGroups: DashboardFocusGroupType[]
}

const props = defineProps<Props>()

const emit = defineEmits<{
  select: [name: string]
}>()

const DEFAULT_VISIBLE_COUNT = 5

const expandedMap = reactive<Record<DashboardFocusGroupKeyType, boolean>>({
  attention: false,
  encouragement: false,
  middleChange: false,
  volatilityWatch: false
})

const activeSectionMap = reactive<Record<DashboardFocusGroupKeyType, string>>({
  attention: '',
  encouragement: '',
  middleChange: '',
  volatilityWatch: ''
})

const middleChangeOrder: Record<string, number> = {
  middleFalling: 0,
  middleRising: 1
}

const volatilityWatchOrder: Record<string, number> = {
  volatilityFalling: 0,
  volatilityRising: 1
}

const getSortedSections = (group: DashboardFocusGroupType) =>
  [...group.sections].sort((a, b) => {
    if (group.key === 'middleChange') {
      const sectionOrderDiff =
        (middleChangeOrder[a.key] ?? Number.MAX_SAFE_INTEGER) -
        (middleChangeOrder[b.key] ?? Number.MAX_SAFE_INTEGER)

      if (sectionOrderDiff !== 0) {
        return sectionOrderDiff
      }
    }

    if (group.key === 'volatilityWatch') {
      const sectionOrderDiff =
        (volatilityWatchOrder[a.key] ?? Number.MAX_SAFE_INTEGER) -
        (volatilityWatchOrder[b.key] ?? Number.MAX_SAFE_INTEGER)

      if (sectionOrderDiff !== 0) {
        return sectionOrderDiff
      }
    }

    if (a.count !== b.count) {
      return b.count - a.count
    }

    return a.label.localeCompare(b.label, 'zh-CN')
  })

const getActiveSection = (group: DashboardFocusGroupType): DashboardFocusSectionType | null => {
  const sections = getSortedSections(group)
  if (!sections.length) return null

  return sections.find((section) => section.key === activeSectionMap[group.key]) || sections[0]
}

const getVisibleItems = (group: DashboardFocusGroupType) => {
  const activeSection = getActiveSection(group)
  const items = activeSection?.items || []

  return expandedMap[group.key] ? items : items.slice(0, DEFAULT_VISIBLE_COUNT)
}

const shouldShowToggle = (group: DashboardFocusGroupType) =>
  (getActiveSection(group)?.items.length || 0) > DEFAULT_VISIBLE_COUNT

const toggleGroupExpanded = (groupKey: DashboardFocusGroupKeyType) => {
  expandedMap[groupKey] = !expandedMap[groupKey]
}

const selectSection = (groupKey: DashboardFocusGroupKeyType, sectionKey: string) => {
  activeSectionMap[groupKey] = sectionKey
  expandedMap[groupKey] = false
}

const hasVisibleItems = () => props.focusGroups.some((group) => group.sections.length > 0)
const hasExpandedGroup = computed(() => Object.values(expandedMap).some(Boolean))

watchEffect(() => {
  props.focusGroups.forEach((group) => {
    const sections = getSortedSections(group)
    const currentSectionKey = activeSectionMap[group.key]

    if (!sections.length) {
      activeSectionMap[group.key] = ''
      expandedMap[group.key] = false
      return
    }

    if (!sections.some((section) => section.key === currentSectionKey)) {
      activeSectionMap[group.key] = sections[0].key
      expandedMap[group.key] = false
    }
  })
})
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
        <div v-if="group.sections.length" class="focus-panel" :class="{ 'is-expanded': expandedMap[group.key] }">
          <div class="focus-section-tabs">
            <button
              v-for="section in getSortedSections(group)"
              :key="section.key"
              class="focus-section-tab"
              :class="[
                `is-${section.key}`,
                { 'is-active': getActiveSection(group)?.key === section.key }
              ]"
              type="button"
              @click="selectSection(group.key, section.key)"
            >
              <span>{{ section.label }}</span>
              <strong>{{ section.count }}</strong>
            </button>
          </div>

          <div v-if="getActiveSection(group)" class="focus-section-meta">
            {{ getActiveSection(group)?.description }}
          </div>

          <el-scrollbar class="focus-scrollbar">
            <div class="focus-list">
              <overview-student-row
                v-for="item in getVisibleItems(group)"
                :key="`${group.key}-${getActiveSection(group)?.key}-${item.name}`"
                :item="item"
                :tone="group.tone"
                variant="panel"
                @select="emit('select', $event)"
              />
            </div>
          </el-scrollbar>

          <button
            v-if="shouldShowToggle(group)"
            class="focus-toggle"
            type="button"
            @click="toggleGroupExpanded(group.key)"
          >
            <span v-if="expandedMap[group.key]">收起全部</span>
            <span v-else>查看全部（{{ getActiveSection(group)?.count || 0 }}人）</span>
            <font-awesome-icon
              :icon="['solid', expandedMap[group.key] ? 'angle-up' : 'angle-right']"
            />
          </button>
        </div>
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
