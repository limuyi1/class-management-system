<script setup lang="ts">
/**
 * 最高/最低/平均分摘要
 * 最高最低分额外展示对应学生名单，超出两名时以浮层展开。
 */
import type { ScoreStatisticsType } from '@/hooks/useScoreStatistics'

/** 组件属性：分数统计结果 */
interface Props {
  scoreStats: ScoreStatisticsType
}

defineProps<Props>()
</script>

<template>
  <div class="summary-row">
    <!-- 最高分与对应学生名单 -->
    <div class="summary-item highlight">
      <div class="item-main">
        <span class="item-label">最高</span>
        <span class="item-value">{{ scoreStats.maxScore }}</span>
        <span class="item-unit">分</span>
      </div>
      <div class="item-tags" v-if="scoreStats.topStudents.length">
        <el-tag
          v-for="(name, idx) in scoreStats.topStudents.slice(0, 2)"
          :key="idx"
          type="success"
          size="small"
          effect="plain"
        >
          {{ name }}
        </el-tag>
        <el-popover
          v-if="scoreStats.topStudents.length > 2"
          placement="bottom"
          trigger="hover"
          :width="180"
        >
          <template #reference>
            <span class="more-tag">+{{ scoreStats.topStudents.length - 2 }}</span>
          </template>
          <div class="popover-tags">
            <el-tag
              v-for="name in scoreStats.topStudents.slice(2)"
              :key="name"
              type="success"
              size="small"
            >
              {{ name }}
            </el-tag>
          </div>
        </el-popover>
      </div>
    </div>

    <!-- 最低分与对应学生名单 -->
    <div class="summary-item danger">
      <div class="item-main">
        <span class="item-label">最低</span>
        <span class="item-value">{{ scoreStats.minScore }}</span>
        <span class="item-unit">分</span>
      </div>
      <div class="item-tags" v-if="scoreStats.bottomStudents.length">
        <el-tag
          v-for="(name, idx) in scoreStats.bottomStudents.slice(0, 2)"
          :key="idx"
          type="danger"
          size="small"
          effect="plain"
        >
          {{ name }}
        </el-tag>
        <el-popover
          v-if="scoreStats.bottomStudents.length > 2"
          placement="bottom"
          trigger="hover"
          :width="180"
        >
          <template #reference>
            <span class="more-tag">+{{ scoreStats.bottomStudents.length - 2 }}</span>
          </template>
          <div class="popover-tags">
            <el-tag
              v-for="name in scoreStats.bottomStudents.slice(2)"
              :key="name"
              type="danger"
              size="small"
            >
              {{ name }}
            </el-tag>
          </div>
        </el-popover>
      </div>
    </div>

    <!-- 平均分 -->
    <div class="summary-item plain">
      <div class="item-main">
        <span class="item-label">平均</span>
        <span class="item-value">{{ scoreStats.avgScore }}</span>
        <span class="item-unit">分</span>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.summary-row {
  display: flex;
  gap: 8px;
  margin-bottom: 10px;

  .summary-item {
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    gap: 3px;
    padding: 8px 8px 7px;
    border-radius: 8px;
    min-height: 60px;
    text-align: center;

    &.highlight {
      background: linear-gradient(135deg, var(--theme-primary) 0%, var(--theme-primary-light) 100%);

      .item-label {
        color: rgba(255, 255, 255, 0.8);
      }
      .item-value {
        color: #fff;
      }
      .item-unit {
        color: rgba(255, 255, 255, 0.7);
      }
    }

    &.danger {
      background: linear-gradient(135deg, #fee2e2 0%, #fecaca 100%);

      .item-label {
        color: #7f1d1d;
      }
      .item-value {
        color: #b91c1c;
      }
      .item-unit {
        color: #991b1b;
      }
    }

    &.plain {
      background: #f8fafc;

      .item-label {
        color: #475569;
      }
      .item-value {
        color: #1e293b;
      }
      .item-unit {
        color: #64748b;
      }
    }

    .item-main {
      display: flex;
      align-items: baseline;
      justify-content: center;
      gap: 4px;
      min-height: 24px;
    }

    .item-label {
      font-size: 12px;
    }

    .item-value {
      font-size: 18px;
      font-weight: bold;
    }

    .item-unit {
      font-size: 11px;
    }

    .item-tags {
      display: flex;
      align-items: center;
      justify-content: center;
      flex-wrap: nowrap;
      gap: 4px;
      min-height: 20px;
      max-width: 100%;
      overflow: hidden;

      :deep(.el-tag) {
        max-width: 68px;
      }

      :deep(.el-tag__content) {
        display: block;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
    }

    .more-tag {
      font-size: 11px;
      color: currentColor;
      background: rgba(255, 255, 255, 0.22);
      padding: 2px 6px;
      border-radius: 4px;
      cursor: pointer;
      transition: background 0.2s;

      &:hover {
        background: rgba(255, 255, 255, 0.4);
      }
    }
  }
}

.popover-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
</style>
