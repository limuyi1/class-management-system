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
    return item[config.value.inputScoreTab] !== null
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
    return e[config.value.inputScoreTab] === null
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
    <el-card>
      <el-popover placement="top" :width="400" trigger="hover" :disabled="!hasNullScoreList.length">
        <template #reference>
          <el-progress
            class="input-data-view--progress"
            text-inside
            :stroke-width="18"
            striped-flow
            :percentage="percentage"
            :format="progressTextFormat"
            :color="colorFun"
          />
        </template>
        <el-tag
          v-for="item in hasNullScoreList"
          :key="item.xing4_ming2"
          style="margin: 0 3px 3px 0"
          class="ml-2"
          type="info"
        >
          {{ item.xing4_ming2 }}
        </el-tag>
      </el-popover>
    </el-card>
    <div class="space"></div>
    <input-card ref="inputCardRef" @scroll="(index) => emit('scroll', index)" />
  </div>
</template>

<style scoped lang="scss">
.input-data-view__wrapper {
  height: calc(100vh - 60px - 55px - 12px);
  box-sizing: border-box;

  .space {
    height: 12px;
  }

  .input-data-view--progress {
    :deep(.el-progress-bar__innerText) {
      line-height: 18px;
      margin-top: -5px;
    }
  }
}
</style>
