<script setup lang="ts">
import { computed, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { ElLoading, ElMessage, ElMessageBox } from 'element-plus'

import PageHeader from '@/components/PageHeader.vue'
import ImageCropper from '@/components/ImageCropper.vue'

import ScoreTableView from '@/views/score/components/ScoreTableView.vue'
import InputDataView from '@/views/score/components/InputDataView.vue'
import ScoreAnalysisView from '@/views/score/components/ScoreAnalysisView.vue'
import { useDataSourceStore } from '@/stores/data-source'
import { useConfigurationStore } from '@/stores/configuration'
import { useSettingStore } from '@/stores/setting'
import { useAIConfigStore } from '@/stores/ai-config'
import { recognizeScoreFromImage } from '@/ai/aiService'
import { fileToBase64 } from '@/utils/fileUntil'
import { NAME_PROP } from '@/types/Constants'
import type { StudentDataType } from '@/types/StudentData'

const tableRef = ref<InstanceType<typeof ScoreTableView>>()
const inputDataRef = ref<InstanceType<typeof InputDataView>>()
const dataStore = useDataSourceStore()
const configuration = useConfigurationStore()
const settingStore = useSettingStore()
const aiConfigStore = useAIConfigStore()

const { items: originList, enabledData } = storeToRefs(dataStore)
const { tableHeaders } = storeToRefs(settingStore)

const scoreColumns = computed(() => tableHeaders.value.filter((item) => item.prop !== NAME_PROP))

const cropperVisible = ref(false)
const cropperImageSrc = ref('')

const ensureDefaultScoreTab = () => {
  if (!configuration.inputScoreTab && scoreColumns.value.length) {
    configuration.inputScoreTab = scoreColumns.value[0].prop
  }
}
ensureDefaultScoreTab()

const autoFocus = () => {
  inputDataRef.value?.autoFocus()
}

const resetScore = () => {
  if (!configuration.inputScoreTab) {
    ElMessage.warning('请先选择当前录入科目')
    return
  }

  ElMessageBox.confirm('确定要重置当前科目分数吗？', '提示', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning'
  }).then(() => {
    enabledData.value.forEach((student) => {
      student[configuration.inputScoreTab as string] = null
    })
    ElMessage.success('已重置当前科目分数')
  })
}

const handleUploadClick = () => {
  if (!aiConfigStore.isConfigured) {
    ElMessage.warning('请先在设置页面配置 AI')
    return
  }

  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'image/*'
  input.onchange = async (e) => {
    const file = (e.target as HTMLInputElement).files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      ElMessage.warning('请上传图片文件')
      return
    }

    try {
      const base64 = await fileToBase64(file)
      cropperImageSrc.value = `data:image/png;base64,${base64}`
      cropperVisible.value = true
    } catch (error) {
      console.error('读取图片失败:', error)
      ElMessage.error('读取图片失败')
    }
  }
  input.click()
}

const handleCropConfirm = async (croppedBase64: string) => {
  cropperVisible.value = false

  const loading = ElLoading.service({
    lock: true,
    text: '正在识别成绩...'
  })

  try {
    // 识图 -> 姓名匹配 -> 写入当前录入科目
    const results = await recognizeScoreFromImage(croppedBase64, aiConfigStore.prompts.imageScore, {
      modelType: aiConfigStore.modelType,
      model: aiConfigStore.model,
      apiKey: aiConfigStore.apiKey,
      baseUrl: aiConfigStore.baseUrl
    })

    if (results.length === 0) {
      ElMessage.warning('未能识别到成绩信息')
      return
    }

    const scoreTab = configuration.inputScoreTab
    if (!scoreTab) {
      ElMessage.warning('请先选择当前录入科目')
      return
    }

    let matchedCount = 0
    let notMatched: string[] = []

    for (const result of results) {
      const student = originList.value.find(
        (item: StudentDataType) => String(item[NAME_PROP] || '') === result.name
      )

      if (student && result.score !== null) {
        student[scoreTab] = result.score
        matchedCount++
      } else if (result.name) {
        notMatched.push(result.name)
      }
    }

    if (notMatched.length > 0) {
      ElMessage.warning(`已匹配 ${matchedCount} 人，未找到：${notMatched.join('、')}`)
    } else {
      ElMessage.success(`成功识别并填充 ${matchedCount} 个成绩`)
    }
  } catch (error) {
    console.error('识别成绩失败:', error)
    ElMessage.error('识别失败：' + (error as Error).message)
  } finally {
    loading.close()
  }
}

const handleCropCancel = () => {
  cropperVisible.value = false
}

defineExpose({ autoFocus })
</script>

<template>
  <div class="score-page app-page-shell">
    <page-header
      :icon="['solid', 'graduation-cap']"
      title="成绩录入"
      subtitle="选择当前科目后，可继续手动录入、AI 识图和查看统计"
    />

    <div class="score-page-content">
      <div class="panel panel-left">
        <score-table-view
          ref="tableRef"
          :score-columns="scoreColumns"
          :score-tab="configuration.inputScoreTab"
          @update:score-tab="(value) => (configuration.inputScoreTab = value)"
          @reset-score="resetScore"
          @edit="(data) => inputDataRef?.editData(data)"
        />
      </div>
      <div class="panel panel-middle">
        <input-data-view
          ref="inputDataRef"
          @scroll="(index) => tableRef?.scroll(index)"
          @upload-image="handleUploadClick"
          @clear-selection="tableRef?.clearActiveSelection()"
        />
      </div>
      <div class="panel panel-right">
        <score-analysis-view :can-export="dataStore.hasAnyScore" />
      </div>
    </div>

    <image-cropper
      v-model:visible="cropperVisible"
      :image-src="cropperImageSrc"
      @confirm="handleCropConfirm"
      @cancel="handleCropCancel"
    />
  </div>
</template>

<style scoped lang="scss">
.score-page {
  min-height: 0;
}

.score-page-content {
  flex: 1;
  min-height: 0;
  display: flex;
  gap: 10px;

  .panel {
    min-height: 0;
    overflow: hidden;
  }

  .panel-left {
    flex: 0 0 25%;
  }

  .panel-middle {
    flex: 0 0 40%;
  }

  .panel-right {
    flex: 0 0 35%;
    padding-right: 8px;
    box-sizing: border-box;
  }
}
</style>
