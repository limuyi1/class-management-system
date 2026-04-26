<script setup lang="ts">
import type { DashboardStudentListItemType } from '@/types/HomeDashboard'

interface Props {
  /** 学生列表项数据 */
  item: DashboardStudentListItemType
  /** 色调类型，对应不同的关注级别 */
  tone: 'danger' | 'warning' | 'success' | 'info'
  /** 展示变体：panel 用于观察站，list 用于关键学生列表 */
  variant?: 'panel' | 'list'
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'panel'
})

const emit = defineEmits<{
  select: [name: string]
}>()

/**
 * 原因标签前缀映射。
 * 根据色调类型显示不同的操作提示。
 */
const prefixMap: Record<Props['tone'], string> = {
  danger: '需关注',
  warning: '波动中',
  success: '可鼓励',
  info: '观察中'
}

const handleSelect = () => {
  emit('select', props.item.name)
}

/** 获取头像文本，取姓名首字母大写 */
const getAvatarText = (name: string) => {
  const trimmedName = name.trim()

  if (!trimmedName) return '?'

  return trimmedName.slice(0, 1).toUpperCase()
}

const directionLabelMap = {
  up: '上行',
  down: '下行',
  volatileUp: '波动上行',
  volatileDown: '波动下行'
} as const

const directionIconNameMap = {
  up: 'arrow-trend-up',
  down: 'arrow-trend-down',
  volatileUp: 'arrow-trend-up',
  volatileDown: 'arrow-trend-down'
} as const
</script>

<template>
  <button class="overview-student-row" :class="[`is-${tone}`, `is-${variant}`]" @click="handleSelect">
    <span class="row-leading">
      <span class="avatar-token">
        {{ getAvatarText(item.name) }}
      </span>
    </span>

    <span class="row-main">
      <span class="name-block">
        <strong>{{ item.name }}</strong>
        <span class="primary-tag">{{ item.primaryTag.label }}</span>
        <span
          v-if="item.volatilityDirection"
          class="direction-tag"
          :class="`is-${item.volatilityDirection}`"
        >
          <font-awesome-icon
            :icon="['solid', directionIconNameMap[item.volatilityDirection]]"
          />
          <span>{{ directionLabelMap[item.volatilityDirection] }}</span>
        </span>
      </span>

      <span class="reason-block">
        <span class="reason-chip">{{ prefixMap[tone] }}</span>
        <span class="reason-text">{{ item.reasonText }}</span>
      </span>
    </span>

    <span class="trend-block">
      <span class="trend-text">
        <span
          v-for="(segment, index) in item.trendSegments"
          :key="`${item.name}-${index}-${segment.text}`"
          :class="[`is-${segment.difficultyShift}`]"
        >
          {{ segment.text }}
        </span>
      </span>
    </span>

    <span class="row-action">
      <font-awesome-icon :icon="['solid', 'angle-right']" />
    </span>
  </button>
</template>

<style scoped lang="scss">
.overview-student-row {
  --row-main: var(--theme-primary);

  width: 100%;
  padding: 10px 0;
  border: 0;
  border-radius: 0;
  background: transparent;
  text-align: left;
  display: grid;
  grid-template-columns: 36px minmax(0, 1fr) auto 14px;
  align-items: center;
  gap: 12px;
  cursor: pointer;
  transition:
    background-color 0.2s ease,
    color 0.2s ease;

  &:hover {
    background: color-mix(in srgb, var(--row-main) 4%, #ffffff);
  }
}

.overview-student-row.is-danger {
  --row-main: #dc2626;
}

.overview-student-row.is-warning {
  --row-main: #d97706;
}

.overview-student-row.is-success {
  --row-main: #059669;
}

.overview-student-row.is-info {
  --row-main: #2563eb;
}

.overview-student-row.is-list {
  padding: 12px 0;
}

.row-leading {
  display: flex;
  align-items: center;
  justify-content: center;
}

.avatar-token {
  width: 36px;
  height: 36px;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: color-mix(in srgb, var(--row-main) 12%, #f8fafc);
  color: var(--row-main);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--row-main) 10%, #dbe4ee);
  font-size: 16px;
  font-weight: 700;
}

.row-main {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.name-block {
  min-width: 0;
  display: inline-flex;
  align-items: center;
  gap: 8px;

  strong {
    font-size: 14px;
    color: var(--text-primary);
    line-height: 1.2;
  }
}

.primary-tag {
  flex-shrink: 0;
  padding: 3px 8px;
  border-radius: 8px;
  background: color-mix(in srgb, var(--row-main) 10%, #fff7ed);
  color: var(--row-main);
  font-size: 12px;
  font-weight: 600;
  line-height: 1;
}

.direction-tag {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 6px;
  border-radius: 999px;
  font-size: 10px;
  font-weight: 700;
  line-height: 1;
}

.direction-tag.is-down {
  background: #fff7ed;
  color: #c2410c;
}

.direction-tag.is-up {
  background: #ecfdf5;
  color: #047857;
}

.direction-tag.is-volatileDown {
  background: #fff1f2;
  color: #be123c;
}

.direction-tag.is-volatileUp {
  background: #ecfeff;
  color: #0f766e;
}

.trend-block {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  align-self: center;
  min-height: 100%;
}

.trend-text {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary);
  white-space: nowrap;

  .is-hard {
    color: #dc2626;
  }

  .is-easy {
    color: #059669;
  }

  .is-normal {
    color: inherit;
  }
}

.reason-block {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.reason-chip {
  flex-shrink: 0;
  padding: 2px 6px;
  border-radius: 6px;
  background: #f1f5f9;
  color: #64748b;
  font-size: 10px;
  font-weight: 600;
  line-height: 1.2;
}

.reason-text {
  min-width: 0;
  font-size: 11px;
  line-height: 1.4;
  color: var(--text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.row-action {
  display: inline-flex;
  align-items: center;
  justify-content: flex-end;
  color: #94a3b8;
  font-size: 14px;
}

@media (max-width: 1280px) {
  .overview-student-row {
    grid-template-columns: 34px minmax(0, 1fr) auto 12px;
    gap: 10px;
  }

  .name-block {
    flex-wrap: wrap;
  }

  .trend-text {
    font-size: 13px;
  }
}
</style>
