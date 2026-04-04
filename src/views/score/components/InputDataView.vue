<script setup lang="ts">
import { computed, ref } from 'vue'
import { storeToRefs } from 'pinia'

import InputCard from '@/views/score/components/InputCard.vue'
import { useProgress } from '@/hooks/useProgress'

import { useDataSourceStore } from '@/stores/data-source'
import { useConfigurationStore } from '@/stores/configuration'

/**
 * 数据录入视图组件
 * 展示成绩录入进度和输入卡片
 */

const store = useDataSourceStore()
const configuration = useConfigurationStore()
const { items: originList } = storeToRefs(store)

const inputCardRef = ref<InstanceType<typeof InputCard>>()

const emit = defineEmits(['scroll'])

/**
 * 使用进度 Hook 计算录入进度
 * 根据当前选中的成绩列计算完成百分比和未完成人数
 */
const { percentage, notCompletedCount: notCompletedCountValue } = useProgress({
  data: originList,
  getValue: (item: any) => (configuration.inputScoreTab ? item[configuration.inputScoreTab] : null)
})

/**
 * 未录入成绩的学生列表
 * 过滤出分数为 null、NaN、空字符串或 undefined 的学生
 */
const hasNullScoreList = computed(() => {
  const scoreTab = configuration.inputScoreTab
  if (!scoreTab) return []
  return originList.value.filter((e: any) => {
    const element = e[scoreTab]
    return element === null || isNaN(element) || element === '' || element === undefined
  })
})

/**
 * 进度条颜色函数
 */
const colorFun = () => {
  return `rgba(82, 155, 46, 1)`
}

/**
 * 进度条文本格式化
 */
const progressTextFormat = (percentage: number) => {
  return `完成率：${percentage.toFixed(0)}%`
}

/**
 * 自动聚焦到输入卡片
 */
const autoFocus = () => {
  inputCardRef.value?.autoFocus()
}

/**
 * 编辑学生数据
 * @param data - 学生行数据
 */
const editData = (data: any) => {
  inputCardRef.value?.editData(data)
}

defineExpose({
  autoFocus,
  editData
})
</script>

<template>
  <div class="input-data-view__wrapper">
    <el-card class="progress-card">
      <div class="progress-header">
        <span class="progress-title">录入进度</span>
        <span class="progress-percent">{{ percentage.toFixed(0) }}%</span>
      </div>
      <el-progress
        class="input-data-view--progress"
        text-inside
        :stroke-width="20"
        :striped="percentage !== 100"
        :striped-flow="percentage !== 100"
        :percentage="percentage"
        :format="progressTextFormat"
        :color="colorFun"
      />
      <el-popover
        placement="bottom"
        :width="320"
        trigger="hover"
        :disabled="!hasNullScoreList.length"
      >
        <template #reference>
          <div class="unfinished-hint" v-if="hasNullScoreList.length">
            <font-awesome-icon :icon="['solid', 'circle-exclamation']" />
            <span>还有 {{ notCompletedCountValue }} 人未录入</span>
          </div>
          <div class="unfinished-hint success" v-else>
            <font-awesome-icon :icon="['solid', 'circle-check']" />
            <span>全部完成！</span>
          </div>
        </template>
        <div class="unfinished-list">
          <el-tag
            v-for="item in hasNullScoreList.slice(0, 20)"
            :key="item.xing4_ming2"
            class="unfinished-tag"
            type="info"
          >
            {{ item.xing4_ming2 }}
          </el-tag>
          <span v-if="hasNullScoreList.length > 20" class="more-hint">
            ...还有 {{ hasNullScoreList.length - 20 }} 人
          </span>
        </div>
      </el-popover>
    </el-card>
    <div class="space"></div>
    <input-card ref="inputCardRef" @scroll="(index) => emit('scroll', index)" />
  </div>
</template>

<style scoped lang="scss">
.input-data-view__wrapper {
  height: calc(100vh - 60px - 55px - 60px);
  box-sizing: border-box;

  .space {
    height: 10px;
  }

  .progress-card {
    border-radius: 10px;
    background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);

    .progress-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 10px;

      .progress-title {
        font-size: 13px;
        font-weight: 600;
        color: #334155;
      }

      .progress-percent {
        font-size: 18px;
        font-weight: bold;
        color: var(--theme-primary);
      }
    }

    .input-data-view--progress {
      :deep(.el-progress-bar__outer) {
        border-radius: 8px;
        background: #e2e8f0;
      }

      :deep(.el-progress-bar__inner) {
        border-radius: 8px;
      }

      :deep(.el-progress-bar__innerText) {
        font-weight: 600;
        font-size: 12px;
      }
    }

    .unfinished-hint {
      display: flex;
      align-items: center;
      gap: 6px;
      margin-top: 10px;
      font-size: 12px;
      color: #64748b;
      cursor: pointer;

      &.success {
        color: var(--theme-primary);
      }
    }

    .unfinished-list {
      max-height: 180px;
      overflow-y: auto;

      .unfinished-tag {
        margin: 3px;
      }

      .more-hint {
        display: block;
        margin-top: 6px;
        color: #94a3b8;
        font-size: 12px;
      }
    }
  }
}
</style>
