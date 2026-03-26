<script setup lang="ts">
import { ref } from 'vue'

import EvaluationTableView from '@/views/evaluation/components/EvaluationTableView.vue'
import ToolPanelView from '@/views/evaluation/components/ToolPanelView.vue'

const evaluationTableViewRef = ref<InstanceType<typeof EvaluationTableView>>()
const toolPanelViewRef = ref<InstanceType<typeof ToolPanelView>>()

const autoFocus = () => {
  toolPanelViewRef.value?.autoFocus()
}

defineExpose({ autoFocus })
</script>

<template>
  <div class="evaluation-page">
    <div class="evaluation-page-header">
      <div class="header-icon">
        <font-awesome-icon :icon="['solid', 'comments']" />
      </div>
      <div class="header-text">
        <h2>期末评语</h2>
        <p>为每位学生撰写期末评语，支持一键导出PDF</p>
      </div>
    </div>
    <div class="evaluation-page-content">
      <div class="evaluation-page-left">
        <evaluation-table-view ref="evaluationTableViewRef" />
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

.evaluation-page-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 8px;
  padding: 16px 20px;
  background: var(--theme-gradient);
  border-radius: 12px;
  color: #fff;

  .header-icon {
    width: 44px;
    height: 44px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(255, 255, 255, 0.2);
    border-radius: 10px;
    font-size: 22px;
  }

  .header-text {
    h2 {
      margin: 0 0 2px 0;
      font-size: 18px;
      font-weight: 600;
    }

    p {
      margin: 0;
      font-size: 13px;
      opacity: 0.85;
    }
  }
}

.evaluation-page-content {
  flex: 1;
  display: flex;
  gap: 12px;
  min-height: 0;

  .evaluation-page-left {
    height: 100%;
    flex: 7;
    min-width: 0;
  }

  .evaluation-page-right {
    height: 100%;
    flex: 2;
    min-width: 280px;
  }
}
</style>
