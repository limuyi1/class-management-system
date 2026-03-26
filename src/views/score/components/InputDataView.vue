<script setup lang="ts">
import { computed, ref } from 'vue'

import InputCard from '@/views/score/components/InputCard.vue'

import { useDataSourceStore } from '@/stores/data-source'
import { useSettingStore } from '@/stores/setting'
import { useConfigurationStore } from '@/stores/configuration'
import { storeToRefs } from 'pinia'

const store = useDataSourceStore()
const settingStore = useSettingStore()
const configuration = useConfigurationStore()
const { data: originList } = storeToRefs(store)
const { data: config } = storeToRefs(configuration)

const inputCardRef = ref<InstanceType<typeof InputCard>>()

const emit = defineEmits(['scroll'])

const percentage = computed(() => {
  const count = originList.value.length
  if (count === 0 || !config.value.inputScoreTab) return 0
  const notEmptyCount = originList.value.filter((item: any) => {
    const element = item[config.value.inputScoreTab]
    return element !== null && element !== '' && !isNaN(element)
  }).length

  return Number((notEmptyCount / count).toFixed(2)) * 100
})

/**
 * 颜色
 * @param percentage
 */
const colorFun = (percentage: number) => {
  // return `rgba(82, 155, 46, ${percentage / 100})`
  return `rgba(82, 155, 46, 1)`
}

/**
 * 进度值
 * @param percentage
 */
const progressTextFormat = (percentage: number) => {
  return `完成率：${percentage.toFixed(2)}%`
}

/**
 * 获取未输入分数的列表
 */
const hasNullScoreList = computed(() => {
  if (!config.value.inputScoreTab) return []
  return originList.value.filter((e: any) => {
    const element = e[config.value.inputScoreTab]
    return element === null || isNaN(element)
  })
})

/**
 * 自动聚焦
 */
const autoFocus = () => {
  inputCardRef.value?.autoFocus()
}

/**
 * 编辑数据
 * @param data
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
        striped
        striped-flow
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
            <span>还有 {{ hasNullScoreList.length }} 人未录入</span>
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
    padding: 14px 16px;
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
