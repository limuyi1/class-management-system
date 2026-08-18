<script setup lang="ts">
/** 错题本页面 — 文件夹管理、题目编辑、图片处理、AI 答案和试卷生成 */
import { computed, ref, onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import { ElMessage } from 'element-plus'

import PageHeader from '@/components/PageHeader.vue'
import FolderTree from '@/views/wrong-book/components/FolderTree.vue'
import QuestionList from '@/views/wrong-book/components/QuestionList.vue'
import QuestionEditor from '@/views/wrong-book/components/QuestionEditor.vue'
import ExamGenerator from '@/views/wrong-book/components/ExamGenerator.vue'
import ImageCropper from '@/components/ImageCropper.vue'
import { useWrongBookStore } from '@/stores/wrong-book'
import { useAIConfigStore } from '@/stores/ai-config'
import { recognizeQuestionFromImage } from '@/ai/aiService'
import { fileToBase64 } from '@/utils/fileUtil'
import { startLoading, stopLoading } from '@/hooks/useLoading'
import type { WrongQuestion } from '@/types/WrongBook'

const wrongBookStore = useWrongBookStore()
const { selectedFolderId, currentFolderQuestions, questions } = storeToRefs(wrongBookStore)
const aiConfigStore = useAIConfigStore()

onMounted(() => {
  wrongBookStore.initFolders()
})

const editorVisible = ref(false)
const examGeneratorVisible = ref(false)
const editingQuestion = ref<WrongQuestion | null>(null)

const cropperVisible = ref(false)
const cropperImageSrc = ref('')
const uploading = ref(false)

const selectedQuestions = ref<string[]>([])

const handleAddQuestion = () => {
  editingQuestion.value = null
  editorVisible.value = true
}

/**
 * 打开编辑器并载入待编辑题目
 * @param question - 待编辑的题目
 */
const handleEditQuestion = (question: WrongQuestion) => {
  editingQuestion.value = { ...question }
  editorVisible.value = true
}

/**
 * 删除题目并提示结果
 * @param id - 题目 id
 */
const handleDeleteQuestion = (id: string) => {
  wrongBookStore.deleteQuestion(id)
  ElMessage.success('删除成功')
}

/**
 * 切换题目收藏状态
 * @param id - 题目 id
 */
const handleToggleFavorite = (id: string) => {
  wrongBookStore.toggleFavorite(id)
}

/** 选择本地图片并打开裁剪器，用于 AI 识别导入错题 */
const handleUploadImage = () => {
  if (!aiConfigStore.isConfigured) {
    ElMessage.warning('请先在设置页面配置 AI')
    return
  }
  // 动态创建文件选择框以触发图片选择
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

/**
 * 裁剪确认后调用 AI 识别题目并回填编辑器
 * @param croppedBase64 - 裁剪后的图片 base64 数据
 */
const handleCropConfirm = async (croppedBase64: string) => {
  cropperVisible.value = false
  uploading.value = true

  startLoading('正在识别题目，请稍候...', 'rgba(255, 255, 255, 0.8)')

  try {
    const result = await recognizeQuestionFromImage(croppedBase64, {
      modelType: aiConfigStore.modelType,
      model: aiConfigStore.model,
      apiKey: aiConfigStore.apiKey,
      baseUrl: aiConfigStore.baseUrl
    })

    editingQuestion.value = {
      id: '',
      folderId: selectedFolderId.value,
      questionText: result.question || '',
      questionImages: result.hasImage ? [croppedBase64] : [],
      answer: result.answer || '',
      explanation: result.explanation || '',
      questionType: result.questionType || '其他',
      difficulty: 3,
      isFavorite: false,
      createdAt: '',
      updatedAt: ''
    }
    editorVisible.value = true
  } catch (error) {
    console.error('识别题目失败:', error)
    ElMessage.error('识别失败：' + (error as Error).message)
  } finally {
    uploading.value = false
    stopLoading()
  }
}

/** 取消裁剪，关闭裁剪器 */
const handleCropCancel = () => {
  cropperVisible.value = false
}

/**
 * 保存题目：存在 id 时更新，否则新增
 * @param question - 待保存的题目数据
 */
const handleSaveQuestion = (question: Omit<WrongQuestion, 'id' | 'createdAt' | 'updatedAt'>) => {
  if (editingQuestion.value?.id) {
    wrongBookStore.updateQuestion(editingQuestion.value.id, question)
    ElMessage.success('更新成功')
  } else {
    wrongBookStore.addQuestion(question)
    ElMessage.success('添加成功')
  }
  editorVisible.value = false
}

/**
 * 同步题目列表的选中结果
 * @param ids - 已选题目 id 列表
 */
const handleSelectionChange = (ids: string[]) => {
  selectedQuestions.value = ids
}

/** 校验选中题目后打开试卷生成弹窗 */
const handleGenerateExam = () => {
  if (selectedQuestions.value.length === 0) {
    ElMessage.warning('请先选择要导出的题目')
    return
  }
  examGeneratorVisible.value = true
}

/** 按选中 id 从全部题目中映射出的题目对象列表 */
const selectedQuestionList = computed(() => {
  return selectedQuestions.value
    .map((id) => questions.value.find((q) => q.id === id))
    .filter((q): q is WrongQuestion => q !== undefined)
})
</script>

<template>
  <div class="wrong-book-page">
    <page-header
      :icon="['solid', 'clipboard-list']"
      title="错题本"
      subtitle="管理错题，AI 识别图片，上传出题"
    >
      <template #right>
        <el-tooltip content="上传图片添加错题" placement="top">
          <el-button size="small" circle :loading="uploading" @click="handleUploadImage">
            <template #icon><font-awesome-icon :icon="['solid', 'camera']" /></template>
          </el-button>
        </el-tooltip>
        <el-tooltip content="手动添加错题" placement="top">
          <el-button size="small" circle @click="handleAddQuestion">
            <template #icon><font-awesome-icon :icon="['solid', 'plus']" /></template>
          </el-button>
        </el-tooltip>
        <el-tooltip content="从已选题目出题" placement="top">
          <el-button
            size="small"
            :disabled="selectedQuestions.length === 0"
            @click="handleGenerateExam"
          >
            <template #icon><font-awesome-icon :icon="['solid', 'file-export']" /></template>
            <span>出题</span>
          </el-button>
        </el-tooltip>
      </template>
    </page-header>

    <el-row class="wrong-book-content" :gutter="10">
      <el-col class="h-full" :span="5">
        <folder-tree />
      </el-col>
      <el-col class="h-full" :span="19">
        <question-list
          :questions="currentFolderQuestions"
          :selected-ids="selectedQuestions"
          @edit="handleEditQuestion"
          @delete="handleDeleteQuestion"
          @toggle-favorite="handleToggleFavorite"
          @selection-change="handleSelectionChange"
        />
      </el-col>
    </el-row>

    <image-cropper
      v-model:visible="cropperVisible"
      :image-src="cropperImageSrc"
      @confirm="handleCropConfirm"
      @cancel="handleCropCancel"
    />

    <question-editor
      v-model:visible="editorVisible"
      :question="editingQuestion"
      :folder-id="selectedFolderId"
      @save="handleSaveQuestion"
    />

    <exam-generator
      v-model:visible="examGeneratorVisible"
      :question-ids="selectedQuestions"
      :all-questions="selectedQuestionList"
    />
  </div>
</template>

<style scoped lang="scss">
.wrong-book-page {
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: 8px;
  box-sizing: border-box;
  background: linear-gradient(135deg, #f5f7fa 0%, #e4e7ed 100%);
}

.wrong-book-content {
  flex: 1;
  min-height: 0;
}

.ml-1 {
  margin-left: 4px;
}
</style>
