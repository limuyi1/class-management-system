<script setup lang="ts">
import { ref } from 'vue'
import { storeToRefs } from 'pinia'
import { ElMessage, ElLoading } from 'element-plus'

import PageHeader from '@/components/PageHeader.vue'

import EvaluationTableView from '@/views/evaluation/components/EvaluationTableView.vue'
import ToolPanelView from '@/views/evaluation/components/ToolPanelView.vue'

import { useDataSourceStore } from '@/stores/data-source'
import { useConfigurationStore } from '@/stores/configuration'
import { useSettingStore } from '@/stores/setting'
import { useAIConfigStore } from '@/stores/ai-config'
import { generateBatchComments } from '@/ai/aiService'
import { exportPDF } from '@/untils/pdfUntil'

const evaluationTableViewRef = ref<InstanceType<typeof EvaluationTableView>>()
const toolPanelViewRef = ref<InstanceType<typeof ToolPanelView>>()

const dataStore = useDataSourceStore()
const { data: students } = storeToRefs(dataStore)
const configuration = useConfigurationStore()
const { data: formData } = storeToRefs(configuration)
const settingStore = useSettingStore()
const { tagCategory: tagCategoryList } = storeToRefs(settingStore)
const aiConfigStore = useAIConfigStore()

const batchGenerating = ref(false)

const autoFocus = () => {
  toolPanelViewRef.value?.autoFocus()
}

const handleExportPDF = () => {
  const doms = document.getElementsByClassName('evaluation-card--table__wrapper')
  exportPDF(doms, formData.value.pageType)
}

/**
 * 处理评语卡片点击事件
 * 点击左侧学生评语卡片时，激活右侧输入区进行编辑
 * @param row - 被点击的学生行数据
 */
const handleCardClick = (row: any) => {
  toolPanelViewRef.value?.fillStudentData(row)
}

const handleBatchGenerate = async () => {
  if (!aiConfigStore.isConfigured) {
    ElMessage.warning('请先在设置页面配置 AI')
    return
  }

  if (!students.value.length) {
    ElMessage.warning('没有学生数据')
    return
  }

  batchGenerating.value = true
  const loading = ElLoading.service({
    lock: true,
    text: '正在批量生成评语...'
  })

  try {
    const studentsData = students.value.map((item) => {
      const allTags: string[] = []
      for (const cat of tagCategoryList.value) {
        const tagList = item.tags?.[cat.prop]
        if (tagList && tagList.length > 0) {
          allTags.push(...tagList)
        }
      }

      return {
        name: item.xing4_ming2,
        tags: allTags,
        score: formData.value.inputScoreTab ? item[formData.value.inputScoreTab] : undefined,
        comment: item.comment
      }
    })

    const result = await generateBatchComments(studentsData, aiConfigStore.prompts.batchComment, {
      modelType: aiConfigStore.modelType,
      model: aiConfigStore.model,
      apiKey: aiConfigStore.apiKey,
      baseUrl: aiConfigStore.baseUrl
    })

    let updatedCount = 0
    for (let i = 0; i < result.length; i++) {
      if (result[i].comment && result[i].comment !== students.value[i].comment) {
        students.value[i].comment = result[i].comment
        updatedCount++
      }
    }

    ElMessage.success(`批量生成完成，已更新 ${updatedCount} 条评语`)
  } catch (error) {
    console.error('批量生成评语失败:', error)
    ElMessage.error('批量生成失败：' + (error as Error).message)
  } finally {
    loading.close()
    batchGenerating.value = false
  }
}

defineExpose({ autoFocus })
</script>

<template>
  <div class="evaluation-page">
    <page-header
      :icon="['solid', 'comments']"
      title="期末评语"
      subtitle="为每位学生撰写期末评语，支持一键导出PDF"
    >
      <template #right>
        <el-tooltip content="AI 批量生成评语" placement="top">
          <el-button size="small" circle :loading="batchGenerating" @click="handleBatchGenerate">
            <font-awesome-icon :icon="['solid', 'wand-magic-sparkles']" />
          </el-button>
        </el-tooltip>
        <el-tooltip content="导出PDF" placement="top">
          <el-button size="small" circle @click="handleExportPDF">
            <font-awesome-icon :icon="['solid', 'print']" />
          </el-button>
        </el-tooltip>
      </template>
    </page-header>
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
