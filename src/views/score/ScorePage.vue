<script setup lang="ts">
import { ref } from 'vue'
import { storeToRefs } from 'pinia'
import { ElMessage, ElLoading } from 'element-plus'

import PageHeader from '@/components/PageHeader.vue'
import ImageCropper from '@/components/ImageCropper.vue'

import ScoreTableView from '@/views/score/components/ScoreTableView.vue'
import InputDataView from '@/views/score/components/InputDataView.vue'
import ScoreAnalysisView from '@/views/score/components/ScoreAnalysisView.vue'
import DownloadBtn from '@/views/score/components/DownloadBtn.vue'
import { useDataSourceStore } from '@/stores/data-source'
import { useConfigurationStore } from '@/stores/configuration'
import { useAIConfigStore } from '@/stores/ai-config'
import { recognizeScoreFromImage } from '@/ai/aiService'
import { fileToBase64 } from '@/utils/fileUntil'

const tableRef = ref<InstanceType<typeof ScoreTableView>>()
const inputDataRef = ref<InstanceType<typeof InputDataView>>()

const dataStore = useDataSourceStore()
const { items: originList } = storeToRefs(dataStore)
const configuration = useConfigurationStore()
const aiConfigStore = useAIConfigStore()

const uploading = ref(false)
const cropperVisible = ref(false)
const cropperImageSrc = ref('')

const autoFocus = () => {
  inputDataRef.value?.autoFocus()
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
      const imageUrl = `data:image/png;base64,${base64}`
      cropperImageSrc.value = imageUrl
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
  uploading.value = true

  const loading = ElLoading.service({
    lock: true,
    text: '正在识别成绩...'
  })

  try {
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
      ElMessage.warning('请先在设置页面选择成绩录入的单元')
      return
    }

    let matchedCount = 0
    let notMatched: string[] = []

    for (const result of results) {
      const student = originList.value.find((item: any) => item.xing4_ming2 === result.name)

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
    uploading.value = false
  }
}

const handleCropCancel = () => {
  cropperVisible.value = false
}

defineExpose({ autoFocus })
</script>

<template>
  <div class="score-page">
    <page-header
      :icon="['solid', 'graduation-cap']"
      title="成绩录入"
      subtitle="点击左侧学生姓名，快速录入分数"
    >
      <template #right>
        <el-tooltip content="上传图片识别成绩" placement="top">
          <el-button size="small" circle :loading="uploading" @click="handleUploadClick">
            <template #icon><font-awesome-icon :icon="['solid', 'camera']" /></template>
          </el-button>
        </el-tooltip>
        <download-btn />
      </template>
    </page-header>
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
