<script setup lang="ts">
import { ref, computed } from 'vue'
import { storeToRefs } from 'pinia'

import ConfigurationCard from '@/views/evaluation/components/ConfigurationCard.vue'
import InputCard from '@/views/score/components/InputCard.vue'

import { InputEnum } from '@/types/Common'

import { useDataSourceStore } from '@/stores/data-source'

const store = useDataSourceStore()

const emit = defineEmits(['scroll'])

const { data } = storeToRefs(store)

const inputCardRef = ref<InstanceType<typeof InputCard>>()

const percentage = computed(() => {
  const count = data.value.length
  if (count === 0) return 0
  const notEmptyCount = data.value.filter(
    (item: any) => item.comment !== null && item.comment !== '' && item.comment !== undefined
  ).length

  return Number((notEmptyCount / count).toFixed(2)) * 100
})

const notCompletedCount = computed(() => {
  return data.value.length - Math.round((data.value.length * percentage.value) / 100)
})

const autoFocus = () => {
  inputCardRef.value?.autoFocus()
}

defineExpose({
  autoFocus
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
