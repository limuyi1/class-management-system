<script setup lang="ts">
/** 学生行组件 — 以紧凑行展示单个关注学生，点击行触发选中 */
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

/** 对外事件：点击学生行时触发 */
const emit = defineEmits<{
  select: [studentId: string]
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

/** 点击行时向父级发出选中事件 */
const handleSelect = () => {
  emit('select', props.item.studentId)
}

/** 获取头像文本，取姓名首字母大写 */
const getAvatarText = (name: string) => {
  const trimmedName = name.trim()

  if (!trimmedName) return '?'

  return trimmedName.slice(0, 1).toUpperCase()
}

/** 走势方向对应的中文标签 */
const directionLabelMap = {
  up: '上行',
  down: '下行',
  volatileUp: '波动上行',
  volatileDown: '波动下行'
} as const

/** 走势方向对应的图标名 */
const directionIconNameMap = {
  up: 'arrow-trend-up',
  down: 'arrow-trend-down',
  volatileUp: 'arrow-trend-up',
  volatileDown: 'arrow-trend-down'
} as const
</script>

<template>
  <button class="overview-student-row" :class="[`is-${tone}`, `is-${variant}`]" @click="handleSelect">
    <!-- 左侧头像区 -->
    <span class="row-leading">
      <span class="avatar-token">
        {{ getAvatarText(item.name) }}
      </span>
    </span>

    <!-- 中部信息区：姓名、主标签、走势标签与推荐原因 -->
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

    <!-- 走势片段展示区 -->
    <span class="trend-block">
      <span class="trend-text">
        <span
          v-for="(segment, index) in item.trendSegments"
          :key="`${item.studentId}-${index}-${segment.text}`"
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
  width: 100%;
  min-width: 0;
  display: inline-flex;
  align-items: center;
  gap: 8px;

  strong {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 14px;
    color: var(--text-primary);
    line-height: 1.2;
  }
}

.primary-tag {
  flex-shrink: 0;
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
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
    flex-wrap: nowrap;
  }

  .trend-text {
    font-size: 13px;
  }
}

@container (max-width: 420px) {
  .overview-student-row {
    grid-template-columns: 34px minmax(0, 1fr) 12px;
    align-items: start;
    gap: 6px 10px;
  }

  .row-leading,
  .row-action {
    padding-top: 2px;
  }

  .row-action {
    grid-column: 3;
    grid-row: 1;
  }

  .row-main {
    grid-column: 2;
    grid-row: 1;
    gap: 5px;
  }

  .name-block {
    gap: 6px;
  }

  .primary-tag {
    max-width: 86px;
  }

  .direction-tag {
    max-width: 72px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .trend-block {
    grid-column: 2 / 4;
    grid-row: 2;
    justify-content: flex-start;
    min-height: auto;
  }

  .trend-text {
    font-size: 12px;
    line-height: 1.3;
  }

  .reason-block {
    gap: 6px;
  }
}

@container (max-width: 340px) {
  .overview-student-row {
    grid-template-columns: 30px minmax(0, 1fr) 10px;
    gap: 6px 8px;
  }

  .avatar-token {
    width: 30px;
    height: 30px;
    font-size: 14px;
  }

  .primary-tag {
    max-width: 72px;
  }

  .direction-tag {
    max-width: 58px;
  }
}
</style>
