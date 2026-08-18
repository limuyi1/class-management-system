<script setup lang="ts">
/**
 * 分数段分布列表
 * 展示各分数段人数与占比，悬停可查看该段学生名单。
 */
import type { ScoreStatisticsType } from '@/hooks/useScoreStatistics'

interface Props {
  scoreStats: ScoreStatisticsType
}

defineProps<Props>()
</script>

<template>
  <div class="range-list">
    <div v-for="range in scoreStats.ranges" :key="range.label" class="range-item">
      <div class="range-left" :style="{ backgroundColor: range.color + '20', color: range.color }">
        {{ range.label }}
      </div>
      <div class="range-middle">
        <div class="progress-bar">
          <div
            class="progress-fill"
            :style="{
              width: `${(range.count / scoreStats.maxCount) * 100}%`,
              backgroundColor: range.color
            }"
          ></div>
        </div>
      </div>
      <div class="range-right">
        <el-popover
          placement="right"
          :width="200"
          trigger="hover"
          :disabled="range.count === 0"
        >
          <template #reference>
            <span class="count-text" :style="{ color: range.color }">
              {{ range.count }} 人
            </span>
          </template>
          <div class="student-list">
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
  </div>
</template>

<style scoped lang="scss">
.range-list {
  margin-bottom: 8px;

  .range-item {
    display: flex;
    align-items: center;
    margin-bottom: 5px;

    .range-left {
      width: 72px;
      padding: 4px 6px;
      font-size: 12px;
      font-weight: 500;
      text-align: center;
      border-radius: 4px;
      flex-shrink: 0;
    }

    .range-middle {
      flex: 1;
      padding: 0 8px;

      .progress-bar {
        height: 16px;
        background: #f1f5f9;
        border-radius: 8px;
        overflow: hidden;

        .progress-fill {
          height: 100%;
          border-radius: 8px;
          transition: width 0.3s ease;
        }
      }
    }

    .range-right {
      width: 50px;
      text-align: right;
      flex-shrink: 0;

      .count-text {
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
      }
    }
  }
}

.student-list {
  max-height: 150px;
  overflow-y: auto;
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
</style>
