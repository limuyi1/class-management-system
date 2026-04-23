<script setup lang="ts">
import type { ScoreStatisticsType } from '@/hooks/useScoreStatistics'

interface Props {
  scoreStats: ScoreStatisticsType
}

defineProps<Props>()
</script>

<template>
  <div v-if="scoreStats.lowScoreTotal === 0" class="low-score-collapse is-disabled">
    <div class="low-score-static-header">
      <div class="collapse-title">
        <span class="collapse-label">60分以下</span>
        <span class="collapse-count">({{ scoreStats.lowScoreTotal }}人)</span>
      </div>
    </div>
  </div>

  <el-collapse
    v-else
    accordion
    class="low-score-collapse"
  >
    <el-collapse-item name="low">
      <template #title>
        <div class="collapse-title">
          <span class="collapse-label">60分以下</span>
          <span class="collapse-count">({{ scoreStats.lowScoreTotal }}人)</span>
          <el-popover
            v-if="scoreStats.allLowScoreStudents.length"
            placement="top"
            trigger="hover"
            :width="200"
          >
            <template #reference>
              <span class="view-all-link">查看名单</span>
            </template>
            <div class="popover-tags">
              <el-tag
                v-for="name in scoreStats.allLowScoreStudents"
                :key="name"
                type="danger"
                size="small"
              >
                {{ name }}
              </el-tag>
            </div>
          </el-popover>
        </div>
      </template>

      <div class="low-range-grid">
        <div v-for="range in scoreStats.lowScoreRanges" :key="range.label" class="low-range-item">
          <el-tag :color="range.color + '15'" :text-color="range.color" size="small" class="range-label">
            {{ range.label }}
          </el-tag>
          <el-popover trigger="hover" :disabled="range.count === 0" placement="top">
            <template #reference>
              <span class="range-count" :style="{ color: range.color }"> {{ range.count }}人 </span>
            </template>
            <div class="student-chip-list">
              <el-tag
                v-for="name in range.students"
                :key="name"
                size="small"
                :style="{ backgroundColor: range.color + '20', color: range.color }"
              >
                {{ name }}
              </el-tag>
            </div>
          </el-popover>
        </div>
      </div>
    </el-collapse-item>
  </el-collapse>
</template>

<style scoped lang="scss">
.low-score-collapse {
  border: none;
  background: #fef2f2;
  border-radius: 8px;

  :deep(.el-collapse-item__header) {
    height: auto;
    line-height: 1.8;
    background: transparent;
    border: none;
    color: #dc2626;
    padding: 8px 12px;
  }

  :deep(.el-collapse-item__wrap) {
    background: transparent;
    border: none;
  }

  :deep(.el-collapse-item__content) {
    padding: 0 12px 12px;
  }

  .low-score-static-header {
    line-height: 1.8;
    color: #dc2626;
    padding: 8px 12px;
  }

  .collapse-title {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 6px;
    width: 100%;

    .collapse-label {
      font-weight: 600;
      font-size: 13px;
    }

    .collapse-count {
      font-size: 12px;
      opacity: 0.8;
    }

    .view-all-link {
      font-size: 12px;
      color: var(--theme-primary);
      cursor: pointer;
      text-decoration: underline;
      margin-left: 8px;
    }
  }

  .low-range-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;

    .low-range-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 6px 8px;
      background: #fff;
      border-radius: 6px;

      .range-label {
        font-size: 11px;
        font-weight: 500;
        border: none;
      }

      .range-count {
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
      }
    }
  }
}

.is-disabled {
  :deep(.el-collapse-item__header) {
    cursor: default;
  }

  :deep(.el-collapse-item__arrow) {
    display: none;
  }
}

.popover-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.student-chip-list {
  max-height: 120px;
  overflow-y: auto;
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
</style>
