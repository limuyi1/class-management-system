<script setup lang="ts">
import { ref } from 'vue'
import { storeToRefs } from 'pinia'

import ConfigurationCard from '@/views/evaluation/components/ConfigurationCard.vue'
import InputCard from '@/views/score/components/InputCard.vue'
import { useProgress } from '@/hooks/useProgress'

import { InputEnum } from '@/types/Common'

import { useDataSourceStore } from '@/stores/data-source'

const store = useDataSourceStore()

const emit = defineEmits(['scroll'])

const { items } = storeToRefs(store)

const inputCardRef = ref<InstanceType<typeof InputCard>>()

const { percentage, notCompletedCount } = useProgress({
  data: items,
  getValue: (item: any) => item.comment
})

const autoFocus = () => {
  inputCardRef.value?.autoFocus()
}

/**
 * 填充学生数据到输入框
 * 点击左侧评语卡片时调用，自动选中该学生并聚焦评语输入框
 * @param row - 学生行数据
 */
const fillStudentData = (row: any) => {
  inputCardRef.value?.editData(row)
}

defineExpose({
  autoFocus,
  fillStudentData
})
</script>

<template>
  <div class="tool-panel-view__wrapper">
    <configuration-card />

    <div class="input-section">
      <div class="progress-bar">
        <div class="progress-info">
          <span class="label">
            <font-awesome-icon :icon="['solid', 'chart-pie']" />
            进度
          </span>
          <span class="percentage">{{ percentage.toFixed(0) }}%</span>
        </div>
        <el-progress
          :percentage="percentage"
          :stroke-width="6"
          :show-text="false"
          color="var(--theme-primary)"
        />
        <div class="progress-hint" v-if="percentage < 100">还差 {{ notCompletedCount }} 人</div>
        <div class="progress-hint success" v-else>
          <font-awesome-icon :icon="['solid', 'circle-check']" />
          全部完成
        </div>
      </div>

      <input-card
        ref="inputCardRef"
        :type="InputEnum.COMMENT"
        @scroll="(index) => emit('scroll', index)"
      />
    </div>
  </div>
</template>

<style scoped lang="scss">
.tool-panel-view__wrapper {
  padding: 0 8px;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 8px;

  .input-section {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .progress-bar {
    padding: 8px 10px;
    background: #f0f9f5;
    border-radius: 6px;

    .progress-info {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 6px;

      .label {
        display: flex;
        align-items: center;
        gap: 4px;
        font-size: 12px;
        color: #64748b;

        svg {
          color: var(--theme-primary);
          font-size: 12px;
        }
      }

      .percentage {
        font-size: 14px;
        font-weight: bold;
        color: var(--theme-primary);
      }
    }

    .progress-hint {
      margin-top: 4px;
      font-size: 11px;
      color: #f59e0b;

      &.success {
        color: var(--theme-primary);
        display: flex;
        align-items: center;
        gap: 4px;
      }
    }
  }
}
</style>
