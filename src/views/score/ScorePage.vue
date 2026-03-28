<script setup lang="ts">
import { ref } from 'vue'

import PageHeader from '@/components/PageHeader.vue'

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
    <page-header
      :icon="['solid', 'graduation-cap']"
      title="成绩录入"
      subtitle="点击左侧学生姓名，快速录入分数"
    />
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

.score-page-content {
  flex: 1;
  min-height: 0;
}
</style>
