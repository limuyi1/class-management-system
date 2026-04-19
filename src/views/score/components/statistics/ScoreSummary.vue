<script setup lang="ts">
import type { ScoreStatisticsType } from '@/hooks/useScoreStatistics'

interface Props {
  scoreStats: ScoreStatisticsType
}

defineProps<Props>()
</script>

<template>
  <div class="summary-row">
    <div class="summary-item highlight">
      <span class="item-label">最高</span>
      <span class="item-value">{{ scoreStats.maxScore }}</span>
      <span class="item-unit">分</span>
      <div class="item-tags">
        <el-tag
          v-for="(name, idx) in scoreStats.topStudents.slice(0, 3)"
          :key="idx"
          type="success"
          size="small"
          effect="dark"
        >
          {{ name }}
        </el-tag>
        <el-popover
          v-if="scoreStats.topStudents.length > 3"
          placement="bottom"
          trigger="hover"
          :width="180"
        >
          <template #reference>
            <span class="more-tag">+{{ scoreStats.topStudents.length - 3 }}</span>
          </template>
          <div class="popover-tags">
            <el-tag
              v-for="name in scoreStats.topStudents.slice(3)"
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

    <div class="summary-item danger">
      <span class="item-label">最低</span>
      <span class="item-value">{{ scoreStats.minScore }}</span>
      <span class="item-unit">分</span>
      <div class="item-tags">
        <el-tag
          v-for="(name, idx) in scoreStats.bottomStudents.slice(0, 3)"
          :key="idx"
          type="danger"
          size="small"
          effect="dark"
        >
          {{ name }}
        </el-tag>
        <el-popover
          v-if="scoreStats.bottomStudents.length > 3"
          placement="bottom"
          trigger="click"
          :width="180"
        >
          <template #reference>
            <span class="more-tag">+{{ scoreStats.bottomStudents.length - 3 }}</span>
          </template>
          <div class="popover-tags">
            <el-tag
              v-for="name in scoreStats.bottomStudents.slice(3)"
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

    <div class="summary-item plain">
      <span class="item-label">平均</span>
      <span class="item-value">{{ scoreStats.avgScore }}</span>
      <span class="item-unit">分</span>
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
    align-items: center;
    flex-wrap: wrap;
    gap: 4px;
    padding: 8px 10px;
    border-radius: 8px;

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
      flex-wrap: wrap;
      gap: 2px;
      margin-left: 4px;
    }

    .more-tag {
      font-size: 11px;
      color: #fff;
      background: rgba(255, 255, 255, 0.25);
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
