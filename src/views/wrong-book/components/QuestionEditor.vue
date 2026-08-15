<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { storeToRefs } from 'pinia'
import { ElDialog, ElForm, ElButton, ElMessage, ElTooltip } from 'element-plus'
import { useWrongBookStore } from '@/stores/wrong-book'
import { useAIConfigStore } from '@/stores/ai-config'
import { fileToBase64 } from '@/utils/fileUtil'
import { generateAnswerFromQuestion } from '@/ai/aiService'
import { startLoading, stopLoading } from '@/hooks/useLoading'
import ImageCropper from '@/components/ImageCropper.vue'
import type { WrongQuestion } from '@/types/WrongBook'
import BasicInfoCard from './BasicInfoCard.vue'
import OriginalImageSection from './OriginalImageSection.vue'
import ContentEditors from './ContentEditors.vue'
import ImageScaleDialog from './ImageScaleDialog.vue'
import ExpandEditorDialog from './ExpandEditorDialog.vue'

interface Props {
  visible: boolean
  question: WrongQuestion | null
  folderId: string
}

interface Emits {
  (e: 'update:visible', value: boolean): void
  (e: 'save', question: Omit<WrongQuestion, 'id' | 'createdAt' | 'updatedAt'>): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const wrongBookStore = useWrongBookStore()
const aiConfigStore = useAIConfigStore()
const { folders, questionTypes } = storeToRefs(wrongBookStore)

const form = ref({
  folderId: props.folderId,
  questionText: '',
  questionImages: [] as string[],
  answer: '',
  explanation: '',
  questionType: '其他',
  difficulty: 3,
  isFavorite: false,
  source: ''
})

const resetForm = (folderId?: string) => {
  form.value = {
    folderId: folderId ?? props.folderId,
    questionText: '',
    questionImages: [],
    answer: '',
    explanation: '',
    questionType: '其他',
    difficulty: 3,
    isFavorite: false,
    source: ''
  }
}

const editorCropperVisible = ref(false)
const editorCropperImageSrc = ref('')

const imageScaleVisible = ref(false)
const pendingImageBase64 = ref('')
const imageScale = ref(100)
const originalImageWidth = ref(0)
const imageAlign = ref<'left' | 'center' | 'right'>('center')

const handleImageInEditor = () => {
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
      editorCropperImageSrc.value = imageUrl
      editorCropperVisible.value = true
    } catch (error) {
      console.error('读取图片失败:', error)
      ElMessage.error('读取图片失败')
    }
  }
  input.click()
}

const handleEditorCropConfirm = (croppedBase64: string) => {
  editorCropperVisible.value = false
  pendingImageBase64.value = croppedBase64
  imageScale.value = 100
  imageAlign.value = 'center'

  const img = new Image()
  img.onload = () => {
    originalImageWidth.value = img.width
    imageScaleVisible.value = true
  }
  img.src = `data:image/jpeg;base64,${croppedBase64}`
}

const handleImageScaleConfirm = (scale: number, align: 'left' | 'center' | 'right') => {
  const base64 = pendingImageBase64.value
  const imageUrl = `data:image/jpeg;base64,${base64}`

  const actualWidth = Math.round(originalImageWidth.value * (scale / 100))
  const widthAttr = ` width="${actualWidth}"`

  let styleAttr = ''
  if (align === 'left') {
    styleAttr = ' style="display:block;margin-right:auto;margin-left:0;"'
  } else if (align === 'right') {
    styleAttr = ' style="display:block;margin-right:0;margin-left:auto;"'
  }

  const htmlImage = `<img src="${imageUrl}"${widthAttr}${styleAttr} />\n`

  if (activeEditorRef.value === 'question') {
    form.value.questionText += htmlImage
  } else if (activeEditorRef.value === 'answer') {
    form.value.answer += htmlImage
  } else if (activeEditorRef.value === 'explanation') {
    form.value.explanation += htmlImage
  }

  imageScaleVisible.value = false
  pendingImageBase64.value = ''
}

const handleEditorCropCancel = () => {
  editorCropperVisible.value = false
}

const setActiveEditor = (field: 'question' | 'answer' | 'explanation') => {
  activeEditorRef.value = field
}

const aiAnswerLoading = ref(false)

const handleAIAnswer = async () => {
  if (!form.value.questionText && form.value.questionImages.length === 0) {
    ElMessage.warning('请先填写题目内容或上传题目图片')
    return
  }

  if (!aiConfigStore.isConfigured) {
    ElMessage.warning('请先配置 AI 服务')
    return
  }

  aiAnswerLoading.value = true
  startLoading('AI 正在生成答案和解析...', 'rgba(255, 255, 255, 0.8)')

  try {
    const config = {
      modelType: aiConfigStore.modelType,
      model: aiConfigStore.model,
      apiKey: aiConfigStore.apiKey,
      baseUrl: aiConfigStore.baseUrl,
      prompts: aiConfigStore.prompts
    }

    const result = await generateAnswerFromQuestion(
      form.value.questionText,
      form.value.questionImages,
      config
    )

    if (result.answer) {
      form.value.answer = result.answer
    }
    if (result.explanation) {
      form.value.explanation = result.explanation
    }

    ElMessage.success('AI 答题成功')
  } catch (error) {
    console.error('AI 答题失败:', error)
    ElMessage.error('AI 答题失败，请检查 AI 配置')
  } finally {
    aiAnswerLoading.value = false
    stopLoading()
  }
}

watch(
  () => props.question,
  (newQuestion) => {
    if (newQuestion) {
      form.value = {
        folderId: newQuestion.folderId,
        questionText: newQuestion.questionText,
        questionImages: newQuestion.questionImages ? [...newQuestion.questionImages] : [],
        answer: newQuestion.answer,
        explanation: newQuestion.explanation || '',
        questionType: newQuestion.questionType || '其他',
        difficulty: newQuestion.difficulty || 3,
        isFavorite: newQuestion.isFavorite,
        source: newQuestion.source || ''
      }
    } else {
      resetForm()
    }
  },
  { immediate: true }
)

watch(
  () => props.folderId,
  (newFolderId) => {
    if (!props.question) {
      form.value.folderId = newFolderId
    }
  }
)

watch(
  () => props.visible,
  (isVisible) => {
    if (!isVisible) {
      return
    }
    if (!props.question) {
      resetForm()
    }
  }
)

const dialogTitle = computed(() => (props.question?.id ? '编辑错题' : '添加错题'))

const handleClose = () => {
  emit('update:visible', false)
}

const handleSave = () => {
  if (!form.value.questionText && form.value.questionImages.length === 0) {
    ElMessage.warning('请填写题目内容或上传题目图片')
    return
  }
  emit('save', { ...form.value })
}

const toggleFavorite = () => {
  form.value.isFavorite = !form.value.isFavorite
}

const expandVisible = ref(false)

const showExpand = () => {
  expandVisible.value = true
}

const contentEditorsRef = ref<InstanceType<typeof ContentEditors> | null>(null)
const activeEditorRef = ref<'question' | 'answer' | 'explanation' | null>(null)
</script>

<template>
  <el-dialog
    :model-value="visible"
    :title="dialogTitle"
    width="80%"
    :close-on-click-modal="false"
    destroy-on-close
    @update:model-value="(val) => emit('update:visible', val)"
  >
    <template #header>
      <div class="dialog-header">
        <el-tooltip :content="form.isFavorite ? '取消收藏' : '收藏此题'" placement="top">
          <div
            class="favorite-btn"
            :class="{ 'is-favorite': form.isFavorite }"
            @click="toggleFavorite"
          >
            <font-awesome-icon :icon="['fas', 'star']" />
          </div>
        </el-tooltip>
        <span class="dialog-title">{{ dialogTitle }}</span>
      </div>
    </template>

    <el-form :model="form" label-width="100px" class="question-form">
      <BasicInfoCard
        :form="{
          folderId: form.folderId,
          questionType: form.questionType,
          source: form.source,
          difficulty: form.difficulty
        }"
        :folders="folders"
        :question-types="questionTypes"
        @update:form="
          (val) => {
            form.folderId = val.folderId
            form.questionType = val.questionType
            form.source = val.source
            form.difficulty = val.difficulty
          }
        "
      />

      <el-card class="form-card content-card" shadow="never">
        <template #header>
          <div class="card-header">
            <span class="card-title">题目内容 / 答案 / 解析</span>
            <div class="card-actions">
              <el-button
                v-if="!props.question"
                size="small"
                type="success"
                :loading="aiAnswerLoading"
                @click="handleAIAnswer"
              >
                <template #icon><font-awesome-icon :icon="['fas', 'magic']" /></template>
                AI 答题
              </el-button>
              <el-button size="small" type="primary" @click="showExpand">
                <template #icon><font-awesome-icon :icon="['fas', 'expand']" /></template>
                扩大
              </el-button>
            </div>
          </div>
        </template>

        <OriginalImageSection
          :images="form.questionImages"
          @update:images="(val) => (form.questionImages = val)"
        />

        <ContentEditors
          ref="contentEditorsRef"
          :question-text="form.questionText"
          :answer="form.answer"
          :explanation="form.explanation"
          @update:question-text="(val) => (form.questionText = val)"
          @update:answer="(val) => (form.answer = val)"
          @update:explanation="(val) => (form.explanation = val)"
          @insert-image="handleImageInEditor"
          @set-active-editor="setActiveEditor"
        />
      </el-card>
    </el-form>

    <template #footer>
      <div class="dialog-footer">
        <el-button @click="handleClose">取消</el-button>
        <el-button type="primary" @click="handleSave">保存</el-button>
      </div>
    </template>

    <image-cropper
      v-model:visible="editorCropperVisible"
      :image-src="editorCropperImageSrc"
      @confirm="handleEditorCropConfirm"
      @cancel="handleEditorCropCancel"
    />

    <ImageScaleDialog
      v-model:visible="imageScaleVisible"
      v-model:image-scale="imageScale"
      v-model:image-align="imageAlign"
      :original-image-width="originalImageWidth"
      @confirm="handleImageScaleConfirm"
    />

    <ExpandEditorDialog
      v-model:visible="expandVisible"
      :question-text="form.questionText"
      :answer="form.answer"
      :explanation="form.explanation"
      @update:question-text="(val) => (form.questionText = val)"
      @update:answer="(val) => (form.answer = val)"
      @update:explanation="(val) => (form.explanation = val)"
    />
  </el-dialog>
</template>

<style scoped lang="scss">
.dialog-header {
  display: flex;
  align-items: center;
  gap: 12px;

  .favorite-btn {
    font-size: 20px;
    color: #c0c4cc;
    cursor: pointer;
    transition: color 0.2s;
    padding: 4px;

    &:hover {
      color: #e6a23c;
    }

    &.is-favorite {
      color: #f7ba2a;
    }
  }

  .dialog-title {
    font-size: 18px;
    font-weight: 600;
  }
}

.question-form {
  .form-card {
    margin-bottom: 16px;
    border-radius: 8px;

    &:last-child {
      margin-bottom: 0;
    }

    :deep(.el-card__header) {
      padding: 12px 16px;
      background: #f5f7fa;
      border-bottom: 1px solid #ebeef5;
    }

    :deep(.el-card__body) {
      padding: 16px;
    }
  }

  .card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;

    .card-title {
      font-size: 15px;
      font-weight: 600;
      color: #303133;
    }

    .card-actions {
      display: flex;
      gap: 8px;
    }
  }
}

.content-card {
  :deep(.el-card__body) {
    padding-bottom: 12px;
  }
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}
</style>
