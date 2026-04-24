<script setup lang="ts">
import { computed } from 'vue'

import type {
  DashboardAlertGroupType,
  DashboardRankingGroupType,
  DashboardStudentListItemType
} from '@/types/HomeDashboard'

interface Props {
  alertGroups: DashboardAlertGroupType[]
  rankingGroups: DashboardRankingGroupType[]
}

const props = defineProps<Props>()

const emit = defineEmits<{
  select: [name: string]
}>()

interface FocusGroupType {
  key: string
  label: string
  tone: 'warning' | 'danger' | 'success' | 'info'
  items: DashboardStudentListItemType[]
}

const getAlertGroup = (key: DashboardAlertGroupType['key']) => {
  return props.alertGroups.find((group) => group.key === key)
}

const getRankingGroup = (key: DashboardRankingGroupType['key']) => {
  return props.rankingGroups.find((group) => group.key === key)
}

const warningGroups = computed<FocusGroupType[]>(() => [
  {
    key: 'largestFluctuation',
    label: '临界 / 波动学生',
    tone: 'warning',
    items: getAlertGroup('largestFluctuation')?.items || []
  },
  {
    key: 'persistentLowScore',
    label: '持续低分',
    tone: 'danger',
    items: getAlertGroup('persistentLowScore')?.items || []
  }
])

const movementGroups = computed<FocusGroupType[]>(() => [
  {
    key: 'declining',
    label: '下滑关注',
    tone: 'danger',
    items: getAlertGroup('declining')?.items || []
  },
  {
    key: 'mostImproved',
    label: '进步明显',
    tone: 'success',
    items: getRankingGroup('mostImproved')?.items || []
  }
])

const honorGroups = computed<FocusGroupType[]>(() => [
  {
    key: 'stableTopFive',
    label: '高分稳定',
    tone: 'info',
    items: getRankingGroup('stableTopFive')?.items || []
  }
])

const getVisibleItems = (items: DashboardStudentListItemType[]) => items.slice(0, 6)

const getSubtitleLines = (subtitle: string) => {
  return subtitle.split('\n').filter(Boolean)
}
</script>

<template>
  <el-card class="focus-center-card">
    <div class="focus-header">
      <div>
        <div class="focus-title">学生观察站</div>
        <div class="focus-subtitle">按预警、异动和荣誉分组聚焦学生</div>
      </div>
    </div>

    <el-tabs class="focus-tabs">
      <el-tab-pane label="重点预警">
        <div class="focus-group-list">
          <section
            v-for="group in warningGroups"
            :key="group.key"
            class="focus-group"
            :class="`is-${group.tone}`"
          >
            <div class="group-heading">
              <span>{{ group.label }}</span>
              <em>{{ group.items.length }} 人</em>
            </div>

            <div v-if="group.items.length" class="student-list">
              <button
                v-for="item in getVisibleItems(group.items)"
                :key="`${group.key}-${item.name}`"
                class="student-row"
                @click="emit('select', item.name)"
              >
                <span class="student-avatar">{{ item.name.slice(0, 1) }}</span>
                <span class="student-main">
                  <span class="student-name">{{ item.name }}</span>
                  <span class="student-subtitle">
                    <span v-for="line in getSubtitleLines(item.subtitle)" :key="line">{{
                      line
                    }}</span>
                  </span>
                </span>
                <span class="student-badge">{{ item.badge }}</span>
              </button>
            </div>

            <el-empty v-else :image-size="44" description="暂无符合条件的学生"></el-empty>
          </section>
        </div>
      </el-tab-pane>

      <el-tab-pane label="异动分析">
        <div class="focus-group-list">
          <section
            v-for="group in movementGroups"
            :key="group.key"
            class="focus-group"
            :class="`is-${group.tone}`"
          >
            <div class="group-heading">
              <span>{{ group.label }}</span>
              <em>{{ group.items.length }} 人</em>
            </div>

            <div v-if="group.items.length" class="student-list">
              <button
                v-for="item in getVisibleItems(group.items)"
                :key="`${group.key}-${item.name}`"
                class="student-row"
                @click="emit('select', item.name)"
              >
                <span class="student-avatar">{{ item.name.slice(0, 1) }}</span>
                <span class="student-main">
                  <span class="student-name">{{ item.name }}</span>
                  <span class="student-subtitle">
                    <span v-for="line in getSubtitleLines(item.subtitle)" :key="line">{{
                      line
                    }}</span>
                  </span>
                </span>
                <span class="student-badge">{{ item.badge }}</span>
              </button>
            </div>

            <el-empty v-else :image-size="44" description="暂无符合条件的学生"></el-empty>
          </section>
        </div>
      </el-tab-pane>

      <el-tab-pane label="荣誉榜单">
        <div class="focus-group-list">
          <section
            v-for="group in honorGroups"
            :key="group.key"
            class="focus-group"
            :class="`is-${group.tone}`"
          >
            <div class="group-heading">
              <span>{{ group.label }}</span>
              <em>{{ group.items.length }} 人</em>
            </div>

            <div v-if="group.items.length" class="student-list">
              <button
                v-for="item in getVisibleItems(group.items)"
                :key="`${group.key}-${item.name}`"
                class="student-row"
                @click="emit('select', item.name)"
              >
                <span class="student-avatar">{{ item.name.slice(0, 1) }}</span>
                <span class="student-main">
                  <span class="student-name">{{ item.name }}</span>
                  <span class="student-subtitle">
                    <span v-for="line in getSubtitleLines(item.subtitle)" :key="line">{{
                      line
                    }}</span>
                  </span>
                </span>
                <span class="student-badge">{{ item.badge }}</span>
              </button>
            </div>

            <el-empty v-else :image-size="44" description="暂无符合条件的学生"></el-empty>
          </section>
        </div>
      </el-tab-pane>
    </el-tabs>
  </el-card>
</template>

<style scoped lang="scss">
.focus-center-card {
  height: 100%;
  min-height: 0;
  border: 1px solid var(--border-muted);
  border-radius: 8px;
  box-shadow: var(--shadow-card);

  :deep(.el-card__body) {
    height: 100%;
    min-height: 0;
    display: flex;
    flex-direction: column;
    box-sizing: border-box;
  }
}

.focus-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.focus-title {
  color: var(--text-primary);
  font-size: 16px;
  font-weight: 700;
}

.focus-subtitle {
  margin-top: 4px;
  color: var(--text-secondary);
  font-size: 12px;
}

.focus-tabs {
  flex: 1;
  min-height: 0;
  margin-top: 6px;

  :deep(.el-tabs__content) {
    height: calc(100% - 48px);
    overflow: hidden;
  }

  :deep(.el-tab-pane) {
    height: 100%;
  }
}

.focus-group-list {
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
  overflow: auto;
  padding-right: 2px;
}

.focus-group {
  --focus-main: var(--theme-primary);
  --focus-soft: color-mix(in srgb, var(--focus-main) 8%, #ffffff);
  --focus-border: color-mix(in srgb, var(--focus-main) 24%, #ffffff);

  padding: 10px;
  border: 1px solid var(--focus-border);
  border-radius: 8px;
  background: var(--focus-soft);
}

.is-warning {
  --focus-main: #d97706;
  --focus-soft: #fffbe6;
  --focus-border: #fde68a;
}

.is-danger {
  --focus-main: #dc2626;
  --focus-soft: #fff1f0;
  --focus-border: #fecaca;
}

.is-success {
  --focus-main: #059669;
  --focus-soft: #ecfdf5;
  --focus-border: #a7f3d0;
}

.is-info {
  --focus-main: #2563eb;
  --focus-soft: #eff6ff;
  --focus-border: #bfdbfe;
}

.group-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 8px;
  color: var(--focus-main);
  font-size: 13px;
  font-weight: 700;

  em {
    font-style: normal;
    font-size: 11px;
    font-weight: 500;
    color: #64748b;
  }
}

.student-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.student-row {
  width: 100%;
  min-width: 0;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: 8px;
  align-items: center;
  padding: 8px;
  border: 1px solid #e5edf5;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.88);
  text-align: left;
  cursor: pointer;
  transition:
    transform 0.2s ease,
    border-color 0.2s ease,
    background-color 0.2s ease;

  &:hover {
    transform: translateY(-1px);
    border-color: var(--focus-border);
    background: #ffffff;
  }
}

.student-avatar {
  width: 28px;
  height: 28px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: var(--focus-main);
  color: #ffffff;
  font-size: 12px;
  font-weight: 700;
}

.student-main {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.student-name {
  min-width: 0;
  color: var(--text-primary);
  font-size: 13px;
  font-weight: 700;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.student-subtitle {
  color: var(--text-secondary);
  font-size: 11px;
  line-height: 1.35;

  span {
    display: block;
  }
}

.student-badge {
  max-width: 88px;
  padding: 3px 7px;
  border-radius: 999px;
  background: var(--focus-main);
  color: #ffffff;
  font-size: 11px;
  font-weight: 700;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

:deep(.el-empty) {
  padding: 8px 0 0;
}

:deep(.el-empty__description p) {
  font-size: 11px;
}
</style>
