<script setup lang="ts">
import { ref } from 'vue'

import PageHeader from '@/components/PageHeader.vue'

import EvaluationTableView from '@/views/evaluation/components/EvaluationTableView.vue'
import ToolPanelView from '@/views/evaluation/components/ToolPanelView.vue'

const evaluationTableViewRef = ref<InstanceType<typeof EvaluationTableView>>()
const toolPanelViewRef = ref<InstanceType<typeof ToolPanelView>>()

const autoFocus = () => {
  toolPanelViewRef.value?.autoFocus()
}

/**
 * 处理评语卡片点击事件
 * 点击左侧学生评语卡片时，激活右侧输入区进行编辑
 * @param row - 被点击的学生行数据
 */
const handleCardClick = (row: any) => {
  toolPanelViewRef.value?.fillStudentData(row)
}

defineExpose({ autoFocus })
</script>

<template>
  <div class="evaluation-page">
    <page-header
      :icon="['solid', 'comments']"
      title="期末评语"
      subtitle="为每位学生撰写期末评语，支持一键导出PDF"
    />
    <div class="evaluation-page-content">
      <div class="evaluation-page-left">
        <evaluation-table-view ref="evaluationTableViewRef" @card-click="handleCardClick" />
      </div>
      <div class="evaluation-page-right">
        <el-scrollbar>
          <tool-panel-view
            ref="toolPanelViewRef"
            @scroll="(index) => evaluationTableViewRef?.scroll(index)"
          />
        </el-scrollbar>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.evaluation-page {
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: 8px;
  box-sizing: border-box;
  background: linear-gradient(135deg, #f5f7fa 0%, #e4e7ed 100%);
}

.evaluation-page-content {
  flex: 1;
  display: flex;
  gap: 10px;
  min-height: 0;

  .evaluation-page-left {
    height: 100%;
    flex: 6;
    min-width: 0;
  }

  .evaluation-page-right {
    height: 100%;
    flex: 2;
    min-width: 280px;
  }
}
</style>
