<script setup lang="ts">
import OverviewStudentRow from '@/views/overview/components/OverviewStudentRow.vue'

import type { DashboardFocusGroupKeyType, DashboardKeyStudentListType } from '@/types/HomeDashboard'

interface Props {
  /** 三类关键学生列表：立即关注、值得鼓励、波动观察 */
  lists: DashboardKeyStudentListType[]
}

const props = defineProps<Props>()

const emit = defineEmits<{
  /** 点击学生行时触发，打开趋势分析抽屉 */
  select: [name: string]
}>()

/**
 * 卡片色调映射，对应 UI 的语义颜色：
 * - attention → danger（红色警示）
 * - encouragement → success（绿色鼓励）
 * - middleChange → info（蓝色中性）
 * - volatilityWatch → warning（橙色观察）
 */
const toneMap: Record<DashboardFocusGroupKeyType, 'danger' | 'warning' | 'success' | 'info'> = {
  attention: 'danger',
  encouragement: 'success',
  middleChange: 'info',
  volatilityWatch: 'warning'
}

const emptyDescriptions: Partial<Record<DashboardFocusGroupKeyType, string>> = {
  attention: '录入成绩后，系统会自动筛选临界、持续低分、明显下滑的学生。',
  encouragement: '录入多次成绩后，系统会识别进步、低位回升和高分稳定学生。',
  volatilityWatch: '有连续成绩后，可查看波动上行、波动下行学生。'
}
</script>

<template>
  <section class="key-student-lists">
    <el-card
      v-for="list in lists"
      :key="list.key"
      class="list-card"
      :class="{ 'is-empty': !list.items.length }"
    >
      <template #header>
        <div class="card-heading">
          <div class="heading-main">
            <span class="heading-title">
              <font-awesome-icon
                :icon="
                  list.key === 'attention'
                    ? ['solid', 'triangle-exclamation']
                    : list.key === 'encouragement'
                      ? ['solid', 'thumbs-up']
                      : ['solid', 'wave-square']
                "
              />
              <span>{{ list.label }}</span>
            </span>
          </div>
          <em>{{
            list.items.length ? `优先推荐 ${Math.min(list.items.length, 3)} 人` : '待生成'
          }}</em>
        </div>
      </template>

      <el-scrollbar v-if="list.items.length" class="student-scrollbar">
        <div class="student-list">
          <overview-student-row
            v-for="item in list.items.slice(0, 3)"
            :key="`${list.key}-${item.name}`"
            :item="item"
            :tone="toneMap[list.key]"
            variant="list"
            @select="emit('select', $event)"
          />
        </div>
      </el-scrollbar>

      <div v-else class="list-empty-state">
        <div class="list-empty-title">暂无可推荐学生</div>
        <div class="list-empty-description">
          {{ emptyDescriptions[list.key] || '录入成绩后，系统会生成对应的学生观察列表。' }}
        </div>
      </div>
    </el-card>
  </section>
</template>

<style scoped lang="scss">
.key-student-lists {
  height: 100%;
  min-height: 148px;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  overflow: hidden;
}

.list-card {
  min-height: 148px;
  height: 100%;
  border-radius: 14px;
  border: 1px solid var(--border-muted);
  box-shadow: var(--shadow-card);

  :deep(.el-card__header) {
    flex-shrink: 0;
    padding: 14px 14px 12px;
  }

  :deep(.el-card__body) {
    flex: 1;
    height: 100%;
    min-height: 0;
    padding: 0 14px 14px;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
}

.card-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
  font-size: 14px;
  font-weight: 700;
  color: var(--text-primary);

  em {
    font-style: normal;
    font-size: 12px;
    font-weight: 500;
    color: var(--text-secondary);
  }
}

.heading-main {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.heading-title {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.student-scrollbar {
  flex: 1;
  min-height: 0;
}

.student-list {
  container-type: inline-size;
  display: flex;
  flex-direction: column;
  gap: 0;
}

:deep(.list-card .el-empty) {
  margin: 0;
}

.list-empty-state {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 6px;
  padding: 8px 4px 4px;
}

.list-empty-title {
  font-size: 14px;
  font-weight: 700;
  color: var(--text-primary);
}

.list-empty-description {
  color: var(--text-secondary);
  font-size: 12px;
  line-height: 1.5;
}

:deep(.student-list .overview-student-row) {
  border-bottom: 1px solid #e8eef6;
}

@media (max-width: 1280px) {
  .key-student-lists {
    grid-template-columns: 1fr;
  }
}
</style>
