<script setup lang="ts">
/**
 * 录入数据视图
 * 展示录入进度与未录入学生名单，并承载分数录入卡片。
 */
import { computed, ref } from 'vue'
import { storeToRefs } from 'pinia'

import EmptyStatePanel from '@/components/EmptyStatePanel.vue'
import ScoreInputCard from '@/views/score/components/ScoreInputCard.vue'
import { useProgress } from '@/hooks/useProgress'

import { useDataSourceStore } from '@/stores/data-source'
import { useConfigurationStore } from '@/stores/configuration'
import { NAME_PROP } from '@/constants'
import type { ScorePageStageType } from '@/types/Score'
import type { StudentDataType } from '@/types/StudentData'

/** 组件属性：页面阶段 */
interface Props {
  stage: ScorePageStageType
}

defineProps<Props>()

// 学生数据与应用配置 store
const store = useDataSourceStore()
const configuration = useConfigurationStore()
const { students: originList } = storeToRefs(store)

// 分数录入卡片实例引用，用于聚焦与编辑
const scoreInputCardRef = ref<InstanceType<typeof ScoreInputCard>>()

/** 组件事件：定位学生、AI 识图、清除选中、跳转单元配置 */
const emit = defineEmits<{
  scroll: [studentId: string]
  uploadImage: []
  clearSelection: []
  goUnitSetting: []
}>()

// 计算当前科目的录入进度百分比与未录入人数
const { percentage, notCompletedCount: notCompletedCountValue } = useProgress({
  data: originList,
  getValue: (item: StudentDataType) =>
    configuration.inputScoreTab ? item[configuration.inputScoreTab] : null
})

/** 当前科目下分数为空或非法的学生列表 */
const hasNullScoreList = computed(() => {
  const scoreTab = configuration.inputScoreTab
  if (!scoreTab) return []
  return originList.value.filter((student) => {
    const value = student[scoreTab]
    if (value === null || value === undefined || value === '') return true
    if (typeof value === 'number') return Number.isNaN(value)
    if (typeof value === 'string') {
      const parsed = Number(value)
      return Number.isNaN(parsed)
    }
    return true
  })
})

// 未录入名单浮层显隐
const unfinishedPopoverVisible = ref(false)

/** 点击未录入学生标签时定位到对应学生 */
const jumpToStudent = (studentId: string) => {
  unfinishedPopoverVisible.value = false
  emit('scroll', studentId)
}

/** 将焦点定位到录入卡片的姓名输入框 */
const autoFocus = () => {
  scoreInputCardRef.value?.autoFocus()
}

/** 编辑指定学生数据 */
const editData = (data: StudentDataType) => {
  scoreInputCardRef.value?.editData(data)
}

defineExpose({
  autoFocus,
  editData
})
</script>

<template>
  <div class="input-data-view__wrapper">
    <!-- 未设置单元时展示空状态引导 -->
    <empty-state-panel
      v-if="stage === 'noUnits'"
      icon="table-columns"
      title="还没有设置单元"
      description="添加单元后，可以为学生录入成绩。"
      action-text="去设置单元"
      @action="emit('goUnitSetting')"
    />

    <!-- 录入进度卡片与未录入名单浮层 -->
    <el-card v-else class="progress-card" shadow="never">
      <div class="progress-header">
        <span class="progress-title">录入进度</span>
        <span class="progress-percent">{{ percentage.toFixed(0) }}%</span>
      </div>
      <el-progress :stroke-width="10" :show-text="false" :percentage="percentage" />
      <el-popover
        v-model:visible="unfinishedPopoverVisible"
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
            <span>全部完成</span>
          </div>
        </template>
        <div class="unfinished-list">
          <el-tag
            v-for="item in hasNullScoreList.slice(0, 20)"
            :key="item.studentId"
            class="unfinished-tag"
            type="info"
            @click="jumpToStudent(item.studentId)"
          >
            {{ item[NAME_PROP] }}
          </el-tag>
          <span v-if="hasNullScoreList.length > 20" class="more-hint">
            ...还有 {{ hasNullScoreList.length - 20 }} 人
          </span>
        </div>
      </el-popover>
    </el-card>

    <!-- 分数录入卡片（无单元时不展示） -->
    <score-input-card
      v-if="stage !== 'noUnits'"
      ref="scoreInputCardRef"
      @scroll="(studentId) => emit('scroll', studentId)"
      @upload-image="emit('uploadImage')"
      @clear-selection="emit('clearSelection')"
    />
  </div>
</template>

<style scoped lang="scss">
.input-data-view__wrapper {
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 0;
}

.progress-card {
  border: 1px solid var(--border-muted);
  border-radius: 12px;
  background: #fff;

  .progress-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;

    .progress-title {
      font-size: 13px;
      font-weight: 600;
      color: var(--text-primary);
    }

    .progress-percent {
      font-size: 16px;
      font-weight: 700;
      color: var(--theme-primary);
    }
  }

  .unfinished-hint {
    display: flex;
    align-items: center;
    width: fit-content;
    gap: 6px;
    margin-top: 8px;
    font-size: 12px;
    color: var(--text-secondary);
    cursor: pointer;

    &.success {
      color: var(--theme-primary);
    }
  }
}

.unfinished-list {
  max-height: 180px;
  overflow-y: auto;

  .unfinished-tag {
    margin: 3px;
    cursor: pointer;
  }

  .unfinished-tag:hover :deep(.el-tag__content) {
    color: var(--theme-primary);
  }

  .more-hint {
    display: block;
    margin-top: 6px;
    color: #94a3b8;
    font-size: 12px;
  }
}
</style>
