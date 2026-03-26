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
  const notEmptyCount = data.value.filter((item: any) => item.comment !== null).length

  return Number((notEmptyCount / count).toFixed(2)) * 100
})

/**
 * 自动聚焦
 */
const autoFocus = () => {
  inputCardRef.value?.autoFocus()
}

/**
 * 颜色
 * @param percentage
 */
const colorFun = (percentage: number) => {
  return `rgba(82, 155, 46,${percentage / 100})`
}

defineExpose({
  autoFocus
})
</script>

<template>
  <div class="tool-panel-view__wrapper">
    <configuration-card />
    <el-row :gutter="16">
      <el-col :span="12">
        <input-card
          ref="inputCardRef"
          :type="InputEnum.COMMENT"
          @scroll="(index) => emit('scroll', index)"
        />
      </el-col>
      <el-col :span="12">
        <el-card class="progress-card">
          <div class="progress-header">
            <font-awesome-icon :icon="['solid', 'chart-pie']" />
            <span>完成进度</span>
          </div>
          <div class="progress-content">
            <el-progress type="dashboard" :percentage="percentage" :width="160" :color="colorFun">
              <template #default="{ percentage: p }">
                <div class="progress-value">
                  <span class="number">{{ p.toFixed(0) }}</span>
                  <span class="unit">%</span>
                </div>
                <div class="progress-label">已完成</div>
              </template>
            </el-progress>
          </div>
          <div class="progress-hint" v-if="percentage < 100">
            还差 {{ data.length - Math.round((data.length * percentage) / 100) }} 人
          </div>
          <div class="progress-hint success" v-else>
            <font-awesome-icon :icon="['solid', 'circle-check']" />
            全部完成！
          </div>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<style scoped lang="scss">
.tool-panel-view__wrapper {
  padding: 0 12px 16px;
  box-sizing: border-box;

  .progress-card {
    border-radius: 10px;
    text-align: center;

    .progress-header {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      margin-bottom: 12px;
      font-weight: 600;
      font-size: 14px;
      color: #334155;

      svg {
        color: var(--theme-primary);
        font-size: 16px;
      }
    }

    .progress-content {
      padding: 12px 0;

      .progress-value {
        .number {
          font-size: 32px;
          font-weight: bold;
          color: var(--theme-primary);
        }

        .unit {
          font-size: 16px;
          color: #94a3b8;
        }
      }

      .progress-label {
        font-size: 13px;
        color: #64748b;
        margin-top: 2px;
      }
    }

    .progress-hint {
      font-size: 12px;
      color: #f59e0b;
      margin-top: 6px;

      &.success {
        color: var(--theme-primary);
      }
    }
  }
}
</style>
