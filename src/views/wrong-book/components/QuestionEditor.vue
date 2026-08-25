<script setup lang="ts">
/** 错题编辑器 — 编辑错题基本信息、题目/答案/解析，支持图片与 AI 答题 */
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

/** 弹窗可见性、待编辑题目与所属文件夹 */
interface Props {
  visible: boolean
  question: WrongQuestion | null
  folderId: string
}

/** 可见性更新与保存事件 */
interface Emits {
  (e: 'update:visible', value: boolean): void
  (e: 'save', question: Omit<WrongQuestion, 'id' | 'createdAt' | 'updatedAt'>): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const wrongBookStore = useWrongBookStore()
const aiConfigStore = useAIConfigStore()
const { folders, questionTypes } = storeToRefs(wrongBookStore)

/** 编辑器表单状态 */
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

/**
 * 重置表单到初始状态
 * @param folderId - 可选，重置时使用的文件夹 id
 */
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

/** 编辑器内图片裁剪器可见性与待裁剪图片源 */
const editorCropperVisible = ref(false)
const editorCropperImageSrc = ref('')

/** 图片缩放设置：待插入图片、缩放比例、原始宽度与对齐方式 */
const imageScaleVisible = ref(false)
const pendingImageBase64 = ref('')
const imageScale = ref(100)
const originalImageWidth = ref(0)
const imageAlign = ref<'left' | 'center' | 'right'>('center')

/** 在编辑器内插入图片：选择文件后进入裁剪流程 */
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

/**
 * 编辑器裁剪确认后，读取图片宽度并打开缩放/对齐设置
 * @param croppedBase64 - 裁剪后的图片 base64 数据
 */
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

/**
 * 依据缩放比例与对齐方式生成 img 标签并插入当前激活的编辑器
 * @param scale - 缩放百分比
 * @param align - 对齐方式
 */
const handleImageScaleConfirm = (scale: number, align: 'left' | 'center' | 'right') => {
  const base64 = pendingImageBase64.value
  const imageUrl = `data:image/jpeg;base64,${base64}`

  const actualWidth = Math.round(originalImageWidth.value * (scale / 100))
  const widthAttr = ` width="${actualWidth}"`

  // 左/右对齐时设置块级与自动外边距，居中对齐则使用默认样式
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

/** 取消编辑器图片裁剪 */
const handleEditorCropCancel = () => {
  editorCropperVisible.value = false
}

/**
 * 记录当前激活的编辑器字段，供图片插入定位
 * @param field - 编辑器所属字段
 */
const setActiveEditor = (field: 'question' | 'answer' | 'explanation') => {
  activeEditorRef.value = field
}

/** AI 答题加载状态 */
const aiAnswerLoading = ref(false)

/** 调用 AI 服务生成答案与解析并回填表单 */
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

// 传入题目变化时回填表单；无题目（新增场景）则重置
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

// 新增场景下跟随外部文件夹变化更新表单
watch(
  () => props.folderId,
  (newFolderId) => {
    if (!props.question) {
      form.value.folderId = newFolderId
    }
  }
)

// 每次打开弹窗且为新增场景时重置表单
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

/** 弹窗标题：按是否存在 id 区分编辑与添加 */
const dialogTitle = computed(() => (props.question?.id ? '编辑错题' : '添加错题'))

/** 关闭弹窗 */
const handleClose = () => {
  emit('update:visible', false)
}

/** 校验表单后触发保存事件 */
const handleSave = () => {
  if (!form.value.questionText && form.value.questionImages.length === 0) {
    ElMessage.warning('请填写题目内容或上传题目图片')
    return
  }
  emit('save', { ...form.value })
}

/** 切换当前题目的收藏状态 */
const toggleFavorite = () => {
  form.value.isFavorite = !form.value.isFavorite
}

/** 全屏展开编辑弹窗可见性 */
const expandVisible = ref(false)

/** 打开全屏展开编辑弹窗 */
const showExpand = () => {
  expandVisible.value = true
}

/** 内容编辑器引用与当前激活的编辑字段 */
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
      <!-- 基本信息：文件夹 / 题型 / 来源 / 难度 -->
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

      <!-- 题目内容 / 答案 / 解析编辑卡片 -->
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

    <!-- 弹窗内嵌：图片裁剪、缩放设置与全屏编辑 -->
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
