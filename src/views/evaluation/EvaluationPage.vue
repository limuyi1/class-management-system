<script setup lang="ts">
import { ref } from 'vue'
import { storeToRefs } from 'pinia'
import { ElMessage, ElLoading, ElMessageBox } from 'element-plus'

import PageHeader from '@/components/PageHeader.vue'

import EvaluationTableView from '@/views/evaluation/components/EvaluationTableView.vue'
import ToolPanelView from '@/views/evaluation/components/ToolPanelView.vue'

import { useDataSourceStore } from '@/stores/data-source'
import { useConfigurationStore } from '@/stores/configuration'
import { useSettingStore } from '@/stores/setting'
import { useAIConfigStore } from '@/stores/ai-config'
import { generateBatchComments } from '@/ai/aiService'
import { exportPDF } from '@/utils/pdfUntil'
import { extractStudentTags } from '@/utils/studentUntil'
import { NAME_PROP } from '@/types/Constants'

/**
 * 期末评语管理页面
 * 展示学生评语列表，提供编辑、AI 生成和 PDF 导出功能
 */

const evaluationTableViewRef = ref<InstanceType<typeof EvaluationTableView>>()
const toolPanelViewRef = ref<InstanceType<typeof ToolPanelView>>()

const dataStore = useDataSourceStore()
const { items: students } = storeToRefs(dataStore)
const configuration = useConfigurationStore()
const settingStore = useSettingStore()
const { tagCategory: tagCategoryList } = storeToRefs(settingStore)
const aiConfigStore = useAIConfigStore()

/**
 * 批量生成中状态
 */
const batchGenerating = ref(false)

/**
 * 自动聚焦到工具面板
 */
const autoFocus = () => {
  toolPanelViewRef.value?.autoFocus()
}

/**
 * 导出 PDF 处理函数
 * 获取所有评语卡片 DOM 元素并导出为 PDF
 */
const handleExportPDF = () => {
  const doms = document.getElementsByClassName('evaluation-card--table__wrapper')
  exportPDF(doms, configuration.pageType)
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

  // 统计已有评语的学生数量
  const existingCount = students.value.filter((item) => item.comment && item.comment.trim()).length
  const emptyCount = students.value.length - existingCount

  // 根据情况选择模式
  let mode: 'skip' | 'overwrite' = 'skip'

  if (existingCount === 0) {
    // 全部为空，直接生成
    mode = 'overwrite'
  } else if (emptyCount === 0) {
    // 全部已有评语，只询问是否覆盖
    try {
      await ElMessageBox.confirm(
        '所有学生已有评语，是否全部重新生成？',
        'AI 批量生成评语',
        {
          confirmButtonText: '覆盖所有',
          cancelButtonText: '取消',
          type: 'info',
          distinguishCancelAndClose: true
        }
      )
      mode = 'overwrite'
    } catch {
      return
    }
  } else {
    // 部分有评语，弹出选择对话框
    try {
      const action = await ElMessageBox.confirm(
        `检测到 ${students.value.length} 名学生中已有 ${existingCount} 名学生有评语，请选择生成方式`,
        'AI 批量生成评语',
        {
          confirmButtonText: '覆盖所有',
          cancelButtonText: '仅填充空评语',
          type: 'info',
          distinguishCancelAndClose: true
        }
      )
      mode = 'overwrite'
    } catch (action) {
      if (action === 'cancel') {
        mode = 'skip'
      } else {
        return
      }
    }
  }

  batchGenerating.value = true
  const loading = ElLoading.service({
    lock: true,
    text: '正在批量生成评语...'
  })

  try {
    // 根据模式构建学生数据
    // 覆盖所有模式：传入空评语让 LLM 重新生成
    // 仅填充空评语模式：只传入评语为空的学生
    const filteredStudents = students.value.filter(
      (item) => mode === 'overwrite' || !item.comment?.trim()
    )

    const studentsData = filteredStudents.map((item) => {
      const allTags = extractStudentTags(item, tagCategoryList.value)

      return {
        name: item[NAME_PROP],
        tags: allTags,
        score: configuration.inputScoreTab ? item[configuration.inputScoreTab] : undefined,
        comment: mode === 'overwrite' ? '' : (item.comment || '')
      }
    })

    // 分批处理，每批15个学生
    const BATCH_SIZE = 15
    const totalBatches = Math.ceil(studentsData.length / BATCH_SIZE)
    const allResults: Array<{ name: string; comment: string | null }> = []
    let failedBatches: number[] = []

    for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
      const start = batchIndex * BATCH_SIZE
      const end = Math.min(start + BATCH_SIZE, studentsData.length)
      const batchData = studentsData.slice(start, end)

      loading.setText(`正在生成第 ${batchIndex + 1}/${totalBatches} 批评语...`)

      try {
        const result = await generateBatchComments(batchData, aiConfigStore.prompts.batchComment, {
          modelType: aiConfigStore.modelType,
          model: aiConfigStore.model,
          apiKey: aiConfigStore.apiKey,
          baseUrl: aiConfigStore.baseUrl
        })

        allResults.push(...result)
      } catch (error) {
        console.error(`第 ${batchIndex + 1} 批生成失败:`, error)
        failedBatches.push(batchIndex + 1)
        // 批次失败时，尝试下一个批次
      }
    }

    if (failedBatches.length > 0) {
      ElMessage.warning(`部分批次生成失败：第 ${failedBatches.join('、')} 批（共 ${totalBatches} 批）`)
    }

    // 更新成功生成的结果
    let updatedCount = 0
    for (let i = 0; i < allResults.length; i++) {
      if (allResults[i].comment) {
        filteredStudents[i].comment = allResults[i].comment
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
            <template #icon
              ><font-awesome-icon :icon="['solid', 'wand-magic-sparkles']"
            /></template>
          </el-button>
        </el-tooltip>
        <el-tooltip content="导出PDF" placement="top">
          <el-button size="small" circle @click="handleExportPDF">
            <template #icon><font-awesome-icon :icon="['solid', 'print']" /></template>
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
