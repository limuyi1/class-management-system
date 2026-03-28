<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { ElMessage } from 'element-plus'
import domtoimage from 'dom-to-image'

import { useDataSourceStore } from '@/stores/data-source'
import { useConfigurationStore } from '@/stores/configuration'

const store = useDataSourceStore()
const configuration = useConfigurationStore()

const { data: originList } = storeToRefs(store)
const { data: config } = storeToRefs(configuration)

const getScore = (item: any): number | null => {
  if (!config.value.inputScoreTab) return null
  return item[config.value.inputScoreTab]
}

/**
 * 阈值输入（默认平均分）
 */
const threshold = ref(60)

/**
 * 低于阈值的学生列表
 */
const belowThresholdStudents = computed(() => {
  if (!config.value.inputScoreTab) return []
  return originList.value
    .filter((e: any) => {
      const score = getScore(e)
      return score !== null && score < threshold.value
    })
    .sort((a: any, b: any) => (getScore(a) || 0) - (getScore(b) || 0))
})

const scoreStats = computed(() => {
  if (!config.value.inputScoreTab) return null

  const scores = originList.value
    .map((e: any) => getScore(e))
    .filter((s): s is number => s !== null && !isNaN(s))

  if (scores.length === 0) return null

  const maxScore = Math.max(...scores)
  const minScore = Math.min(...scores)
  const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length

  const ranges = [
    { label: '90-100分', min: 90, max: 100, color: '#22c55e' },
    { label: '80-89分', min: 80, max: 89, color: '#3b82f6' },
    { label: '70-79分', min: 70, max: 79, color: '#eab308' },
    { label: '60-69分', min: 60, max: 69, color: '#f97316' }
  ]

  const lowScoreRanges = [
    { label: '50-59分', min: 50, max: 59, color: '#ef4444' },
    { label: '40-49分', min: 40, max: 49, color: '#dc2626' },
    { label: '30-39分', min: 30, max: 39, color: '#b91c1c' },
    { label: '20-29分', min: 20, max: 29, color: '#991b1b' },
    { label: '10-19分', min: 10, max: 19, color: '#7f1d1d' },
    { label: '0-9分', min: 0, max: 9, color: '#450a0a' }
  ]

  const getRangeData = (range: { min: number; max: number }) => {
    const count = scores.filter((s) => s >= range.min && s <= range.max).length
    const students = originList.value
      .filter((e: any) => {
        const score = getScore(e)
        return score !== null && score >= range.min && score <= range.max
      })
      .sort((a: any, b: any) => (getScore(b) || 0) - (getScore(a) || 0))
      .map((e: any) => e.xing4_ming2)
    return { count, students }
  }

  const rangeData = ranges
    .map((range) => {
      const data = getRangeData(range)
      return { ...range, ...data }
    })
    .filter((r) => r.count > 0)

  const lowScoreData = lowScoreRanges
    .map((range) => {
      const data = getRangeData(range)
      return { ...range, ...data }
    })
    .filter((r) => r.count > 0)

  const topStudents = originList.value
    .filter((e: any) => getScore(e) === maxScore)
    .map((e: any) => e.xing4_ming2)

  const bottomStudents = originList.value
    .filter((e: any) => getScore(e) === minScore)
    .map((e: any) => e.xing4_ming2)

  const allLowScoreStudents = originList.value
    .filter((e: any) => {
      const score = getScore(e)
      return score !== null && score < 60
    })
    .sort((a: any, b: any) => (getScore(a) || 0) - (getScore(b) || 0))
    .map((e: any) => e.xing4_ming2)

  const maxCount = Math.max(...rangeData.map((r) => r.count), 1)

  return {
    maxScore,
    maxScoreCount: topStudents.length,
    topStudents,
    minScore,
    minScoreCount: bottomStudents.length,
    bottomStudents,
    avgScore: avgScore.toFixed(2),
    ranges: rangeData,
    lowScoreRanges: lowScoreData,
    lowScoreTotal: allLowScoreStudents.length,
    allLowScoreStudents,
    maxCount,
    totalCount: scores.length
  }
})

// 监听 scoreStats，首次加载时设置阈值为平均分
watch(
  () => scoreStats.value,
  (newVal) => {
    if (newVal && threshold.value === 60) {
      threshold.value = parseFloat(newVal.avgScore)
    }
  },
  { immediate: true }
)

const copyToClipboard = () => {
  if (!scoreStats.value) return

  const { maxScore, maxScoreCount, topStudents, ranges, lowScoreRanges, avgScore, totalCount } =
    scoreStats.value

  let text = `成绩分布统计（共${totalCount}人）\n`
  text += `最高分：${maxScore}分（${maxScoreCount}人）${topStudents.join('、')}\n`
  text += `平均分：${avgScore}分\n`

  ranges.forEach((r) => {
    text += `${r.label}：${r.count}人\n`
  })

  lowScoreRanges.forEach((r) => {
    text += `${r.label}：${r.count}人\n`
  })

  navigator.clipboard
    .writeText(text)
    .then(() => {
      ElMessage.success('复制成功！')
    })
    .catch(() => {
      ElMessage.error('复制失败')
    })
}

/**
 * 下载图片
 * @param mode 'withScore' | 'nameOnly'
 */
const downloadImage = (mode: 'withScore' | 'nameOnly') => {
  const students = belowThresholdStudents.value
  if (students.length === 0) {
    ElMessage.warning('暂无学生数据')
    return
  }

  const headerHtml =
    mode === 'withScore'
      ? '<th style="border:1px solid #ddd;padding:8px;background:#f5f5f5;">姓名</th><th style="border:1px solid #ddd;padding:8px;background:#f5f5f5;">分数</th>'
      : '<th style="border:1px solid #ddd;padding:8px;background:#f5f5f5;">姓名</th>'

  const bodyHtml = students
    .map((s) => {
      const row = `<td style="border:1px solid #ddd;padding:8px;text-align:center;">${s.xing4_ming2}</td>`
      const scoreRow =
        mode === 'withScore'
          ? `<td style="border:1px solid #ddd;padding:8px;text-align:center;">${getScore(s)}分</td>`
          : ''
      return `<tr>${row}${scoreRow}</tr>`
    })
    .join('')

  const html = `
    <table style="border-collapse:collapse;width:100%;font-family:sans-serif;font-size:14px;">
      <thead><tr>${headerHtml}</tr></thead>
      <tbody>${bodyHtml}</tbody>
    </table>
  `

  const container = document.createElement('div')
  container.innerHTML = html
  container.style.padding = '20px'
  container.style.background = '#fff'
  container.style.position = 'absolute'
  container.style.top = '0'
  container.style.left = '0'
  container.style.zIndex = '-1000'
  document.body.appendChild(container)

  domtoimage
    .toJpeg(container, { quality: 1, bgcolor: '#fff' })
    .then((dataUrl: string) => {
      const link = document.createElement('a')
      link.download = `低分学生_${threshold.value}分.jpg`
      link.href = dataUrl
      link.click()
      ElMessage.success('下载成功')
    })
    .catch(() => {
      ElMessage.error('下载失败')
    })
    .finally(() => {
      container.remove()
    })
}
</script>

<template>
  <el-card class="statistics-card__wrapper">
    <div class="card-header">
      <div class="card-title">
        <font-awesome-icon :icon="['solid', 'list']" />
        <span>分数分布</span>
      </div>
      <el-button type="primary" size="small" round @click="copyToClipboard" v-if="scoreStats">
        <font-awesome-icon :icon="['solid', 'copy']" />
        复制
      </el-button>
    </div>

    <template v-if="scoreStats">
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
              trigger="click"
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

      <!-- 低于阈值学生区域 -->
      <div class="threshold-section" v-if="scoreStats">
        <div class="threshold-input-wrap">
          <span>低于</span>
          <el-input-number
            v-model="threshold"
            :min="0"
            :max="100"
            :step="5"
            size="small"
            controls-position="right"
            class="threshold-input"
          />
          <span>分的学生 ({{ belowThresholdStudents.length }}人)</span>
        </div>
        <el-dropdown trigger="hover">
          <el-button type="primary" size="small" round>
            <font-awesome-icon :icon="['solid', 'download']" />
            下载
          </el-button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item @click="downloadImage('withScore')">姓名 + 分数</el-dropdown-item>
              <el-dropdown-item @click="downloadImage('nameOnly')">仅姓名</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </div>

      <!-- 学生列表（超过8人折叠） -->
      <div class="student-tags" v-if="belowThresholdStudents.length">
        <template v-if="belowThresholdStudents.length <= 8">
          <el-tag
            v-for="item in belowThresholdStudents"
            :key="item.xing4_ming2"
            type="warning"
            size="small"
          >
            {{ item.xing4_ming2 }} {{ getScore(item) }}分
          </el-tag>
        </template>
        <template v-else>
          <el-tag
            v-for="item in belowThresholdStudents.slice(0, 8)"
            :key="item.xing4_ming2"
            type="warning"
            size="small"
          >
            {{ item.xing4_ming2 }} {{ getScore(item) }}分
          </el-tag>
          <el-popover placement="bottom" :width="200">
            <template #reference>
              <el-tag type="warning" size="small"
                >...+{{ belowThresholdStudents.length - 8 }}人</el-tag
              >
            </template>
            <div class="popover-tags">
              <el-tag
                v-for="item in belowThresholdStudents.slice(8)"
                :key="item.xing4_ming2"
                type="warning"
                size="small"
                class="mb-1"
              >
                {{ item.xing4_ming2 }} {{ getScore(item) }}分
              </el-tag>
            </div>
          </el-popover>
        </template>
      </div>

      <div class="range-list">
        <div v-for="range in scoreStats.ranges" :key="range.label" class="range-item">
          <div
            class="range-left"
            :style="{ backgroundColor: range.color + '20', color: range.color }"
          >
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
                <div class="student-tag" v-for="(name, idx) in range.students" :key="idx">
                  {{ name }}
                </div>
              </div>
            </el-popover>
          </div>
        </div>
      </div>

      <el-collapse accordion class="low-score-collapse">
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
            <div
              v-for="range in scoreStats.lowScoreRanges"
              :key="range.label"
              class="low-range-item"
            >
              <el-tag
                :color="range.color + '15'"
                :text-color="range.color"
                size="small"
                class="range-label"
              >
                {{ range.label }}
              </el-tag>
              <el-popover trigger="hover" :disabled="range.count === 0" placement="top">
                <template #reference>
                  <span class="range-count" :style="{ color: range.color }">
                    {{ range.count }}人
                  </span>
                </template>
                <div class="student-chip-list">
                  <el-tag v-for="name in range.students" :key="name" size="small" type="danger">
                    {{ name }}
                  </el-tag>
                </div>
              </el-popover>
            </div>
          </div>
        </el-collapse-item>
      </el-collapse>
    </template>

    <div v-else class="empty-hint">
      <font-awesome-icon :icon="['solid', 'chart-simple']" />
      <span>暂无成绩数据</span>
    </div>
  </el-card>
</template>

<style scoped lang="scss">
.statistics-card__wrapper {
  border-radius: 10px;
  height: 100%;

  .card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 10px;

    .card-title {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 14px;
      font-weight: 600;
      color: #334155;

      svg {
        color: var(--theme-primary);
        font-size: 16px;
      }
    }
  }

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
        background: linear-gradient(
          135deg,
          var(--theme-primary) 0%,
          var(--theme-primary-light) 100%
        );

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
          color: #991b1b;
        }
        .item-value {
          color: #dc2626;
        }
        .item-unit {
          color: #f87171;
        }
      }

      &.plain {
        background: #f8fafc;

        .item-label {
          color: #64748b;
        }
        .item-value {
          color: #334155;
        }
        .item-unit {
          color: #94a3b8;
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

  .threshold-section {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 12px;
    background: #fef3c7;
    border-radius: 8px;
    margin-bottom: 10px;

    .threshold-input-wrap {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 14px;
      color: #92400e;
    }

    .threshold-input {
      width: 80px;
    }
  }

  .student-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-bottom: 10px;
  }

  :deep(.mb-1) {
    display: block;
    margin-bottom: 4px;
  }

  .popover-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }

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

    .collapse-title {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 6px;
      width: 100%;

      svg {
        font-size: 12px;
        transition: transform 0.3s ease;
        &.rotated {
          transform: rotate(180deg);
        }
      }

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

  .popover-tags {
    max-height: 160px;
    overflow-y: auto;

    .el-tag {
      margin: 3px;
    }
  }

  .student-list {
    max-height: 150px;
    overflow-y: auto;

    .student-tag {
      display: inline-block;
      margin: 3px;
      padding: 3px 6px;
      background: #f1f5f9;
      border-radius: 4px;
      font-size: 12px;
    }
  }

  .student-chip-list {
    max-height: 120px;
    overflow-y: auto;

    .el-tag {
      margin: 2px;
    }
  }

  .empty-hint {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 40px 0;
    color: #94a3b8;

    svg {
      font-size: 40px;
      margin-bottom: 12px;
    }
  }
}
</style>
