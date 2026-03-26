<script setup lang="ts">
import { ref } from 'vue'

import ScoreTableView from '@/views/score/components/ScoreTableView.vue'
import InputDataView from '@/views/score/components/InputDataView.vue'
import ScoreAnalysisView from '@/views/score/components/ScoreAnalysisView.vue'

const tableRef = ref<InstanceType<typeof ScoreTableView>>()
const inputDataRef = ref<InstanceType<typeof InputDataView>>()

const autoFocus = () => {
  inputDataRef.value?.autoFocus()
}

defineExpose({ autoFocus })
</script>

<template>
  <div class="score-page">
    <div class="score-page-header">
      <div class="header-icon">
        <font-awesome-icon :icon="['solid', 'graduation-cap']" />
      </div>
      <div class="header-text">
        <h2>成绩录入</h2>
        <p>点击左侧学生姓名，快速录入分数</p>
      </div>
    </div>
    <el-row class="score-page-content" :gutter="10">
      <el-col class="h-full" :span="6">
        <score-table-view ref="tableRef" @edit="(data) => inputDataRef?.editData(data)" />
      </el-col>
      <el-col class="h-full" :span="6">
        <input-data-view ref="inputDataRef" @scroll="(index) => tableRef?.scroll(index)" />
      </el-col>
      <el-col class="h-full" :span="12">
        <el-scrollbar>
          <score-analysis-view />
        </el-scrollbar>
      </el-col>
    </el-row>
  </div>
</template>

<style scoped lang="scss">
.score-page {
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: 8px;
  box-sizing: border-box;
  background: linear-gradient(135deg, #f5f7fa 0%, #e4e7ed 100%);
}

.score-page-header {
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

.score-page-content {
  flex: 1;
  min-height: 0;
}
</style>
