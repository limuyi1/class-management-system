<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { storeToRefs } from 'pinia'
import {
  ElDialog,
  ElForm,
  ElFormItem,
  ElInput,
  ElSelect,
  ElOption,
  ElSlider,
  ElButton,
  ElMessage,
  ElCard,
  ElLoading,
  ElTooltip,
  ElImageViewer
} from 'element-plus'
import { useWrongBookStore } from '@/stores/wrong-book'
import { useAIConfigStore } from '@/stores/ai-config'
import { fileToBase64 } from '@/utils/fileUntil'
import { generateAnswerFromQuestion } from '@/ai/aiService'
import MarkdownEditor from '@/components/MarkdownEditor.vue'
import ImageCropper from '@/components/ImageCropper.vue'
import type { WrongQuestion } from '@/types/WrongBook'

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

const editorCropperVisible = ref(false)
const editorCropperImageSrc = ref('')

const imageScaleVisible = ref(false)
const pendingImageBase64 = ref('')
const imageScale = ref(100)
const originalImageWidth = ref(0)
const imageAlign = ref('center')

const scaleOptions = [
  { label: '20%', value: 20 },
  { label: '40%', value: 40 },
  { label: '60%', value: 60 },
  { label: '80%', value: 80 },
  { label: '100%', value: 100 },
  { label: '200%', value: 200 }
]

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

const handleImageScaleConfirm = () => {
  const base64 = pendingImageBase64.value
  const imageUrl = `data:image/jpeg;base64,${base64}`

  const actualWidth = Math.round(originalImageWidth.value * (imageScale.value / 100))
  const widthAttr = ` width="${actualWidth}"`

  let styleAttr = ''
  if (imageAlign.value === 'left') {
    styleAttr = ' style="display:block;margin-right:auto;margin-left:0;"'
  } else if (imageAlign.value === 'right') {
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
  const loading = ElLoading.service({
    lock: true,
    text: 'AI 正在生成答案和解析...',
    background: 'rgba(255, 255, 255, 0.8)'
  })

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
    loading.close()
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
      form.value = {
        folderId: props.folderId,
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
      form.value = {
        folderId: props.folderId,
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

const cropperVisible = ref(false)
const cropperImageSrc = ref('')

const handleAddImage = () => {
  if (form.value.questionImages.length >= 1) {
    ElMessage.warning('题目图片只能上传一张')
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
      const imageUrl = `data:image/jpeg;base64,${base64}`
      cropperImageSrc.value = imageUrl
      cropperVisible.value = true
    } catch (error) {
      console.error('读取图片失败:', error)
      ElMessage.error('读取图片失败')
    }
  }
  input.click()
}

const handleCropConfirm = (croppedBase64: string) => {
  cropperVisible.value = false
  form.value.questionImages.push(croppedBase64)
}

const handleCropCancel = () => {
  cropperVisible.value = false
}

const handleRemoveImage = (index: number) => {
  form.value.questionImages.splice(index, 1)
}

const imagePreviewVisible = ref(false)
const imagePreviewUrl = ref('')

const handleImageClick = (index: number) => {
  const img = form.value.questionImages[index]
  imagePreviewUrl.value = `data:image/jpeg;base64,${img}`
  imagePreviewVisible.value = true
}

const marks = {
  1: '简单',
  2: '较简单',
  3: '一般',
  4: '较难',
  5: '困难'
}

const toggleFavorite = () => {
  form.value.isFavorite = !form.value.isFavorite
}

const previewVisible = ref(false)
const previewContent = ref('')

const expandVisible = ref(false)
const expandQuestion = ref('')
const expandAnswer = ref('')
const expandExplanation = ref('')
const expandQuestionRef = ref<InstanceType<typeof MarkdownEditor> | null>(null)
const expandAnswerRef = ref<InstanceType<typeof MarkdownEditor> | null>(null)
const expandExplanationRef = ref<InstanceType<typeof MarkdownEditor> | null>(null)

const questionEditorRef = ref<InstanceType<typeof MarkdownEditor> | null>(null)
const answerEditorRef = ref<InstanceType<typeof MarkdownEditor> | null>(null)
const explanationEditorRef = ref<InstanceType<typeof MarkdownEditor> | null>(null)
const activeEditorRef = ref<'question' | 'answer' | 'explanation' | null>(null)

const showExpand = () => {
  expandQuestion.value = form.value.questionText
  expandAnswer.value = form.value.answer
  expandExplanation.value = form.value.explanation
  expandVisible.value = true
}

const handleExpandSave = () => {
  form.value.questionText = expandQuestionRef.value?.getContent?.() || ''
  form.value.answer = expandAnswerRef.value?.getContent?.() || ''
  form.value.explanation = expandExplanationRef.value?.getContent?.() || ''
  expandVisible.value = false
}
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
      <el-card class="form-card" shadow="never">
        <template #header>
          <div class="card-header">
            <span class="card-title">基本信息</span>
          </div>
        </template>
        <div class="form-row">
          <el-form-item label="所属文件夹" class="flex-1">
            <el-select v-model="form.folderId" placeholder="选择文件夹" style="width: 100%">
              <el-option
                v-for="folder in folders"
                :key="folder.id"
                :label="folder.name"
                :value="folder.id"
              />
            </el-select>
          </el-form-item>
          <el-form-item label="题型" class="flex-1">
            <el-select v-model="form.questionType" placeholder="选择题型" style="width: 100%">
              <el-option
                v-for="type in questionTypes"
                :key="type.value"
                :label="type.label"
                :value="type.value"
              />
            </el-select>
          </el-form-item>
          <el-form-item label="来源" class="flex-1">
            <el-input v-model="form.source" placeholder="如：2024年期末考试" />
          </el-form-item>
        </div>
        <el-form-item label="难度">
          <div class="difficulty-slider">
            <el-slider v-model="form.difficulty" :min="1" :max="5" :marks="marks" :step="1" />
          </div>
        </el-form-item>
      </el-card>

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
        <el-form-item label="题目原始图片" class="original-image-form-item">
          <div class="original-image-section">
            <div v-if="form.questionImages.length > 0" class="original-image-list">
              <div
                v-for="(img, index) in form.questionImages"
                :key="index"
                class="original-image-item"
              >
                <img
                  :src="`data:image/jpeg;base64,${img}`"
                  alt="题目原始图片"
                  @click="handleImageClick(index)"
                />
                <div class="original-image-actions">
                  <el-button
                    size="small"
                    circle
                    type="danger"
                    @click.stop="handleRemoveImage(index)"
                  >
                    <template #icon><font-awesome-icon :icon="['fas', 'trash']" /></template>
                  </el-button>
                </div>
              </div>
            </div>
            <div v-else class="original-image-add" @click="handleAddImage">
              <font-awesome-icon :icon="['fas', 'plus']" />
              <span>添加题目原始图片</span>
            </div>
          </div>
        </el-form-item>
        <div class="content-editors">
          <div class="editor-section">
            <h4>题目内容</h4>
            <MarkdownEditor
              ref="questionEditorRef"
              v-model="form.questionText"
              placeholder="请输入题目内容..."
              :show-preview="false"
              :show-split-mode="true"
              @click="setActiveEditor('question')"
              @insert-image="handleImageInEditor"
            />
          </div>
          <div class="editor-section">
            <h4>答案</h4>
            <MarkdownEditor
              ref="answerEditorRef"
              v-model="form.answer"
              placeholder="请输入答案..."
              :show-preview="false"
              :show-split-mode="true"
              @click="setActiveEditor('answer')"
            />
          </div>
          <div class="editor-section">
            <h4>解析</h4>
            <MarkdownEditor
              ref="explanationEditorRef"
              v-model="form.explanation"
              placeholder="请输入解析..."
              :show-preview="false"
              :show-split-mode="true"
              @click="setActiveEditor('explanation')"
            />
          </div>
        </div>
      </el-card>
    </el-form>

    <template #footer>
      <div class="dialog-footer">
        <el-button @click="handleClose">取消</el-button>
        <el-button type="primary" @click="handleSave">保存</el-button>
      </div>
    </template>

    <image-cropper
      v-model:visible="cropperVisible"
      :image-src="cropperImageSrc"
      @confirm="handleCropConfirm"
      @cancel="handleCropCancel"
    />

    <image-cropper
      v-model:visible="editorCropperVisible"
      :image-src="editorCropperImageSrc"
      @confirm="handleEditorCropConfirm"
      @cancel="handleEditorCropCancel"
    />

    <el-dialog v-model="imageScaleVisible" title="设置图片尺寸和位置" width="450px" append-to-body>
      <div class="image-settings">
        <div class="setting-row">
          <span class="label">缩放比例：</span>
          <el-select v-model="imageScale" placeholder="请选择">
            <el-option
              v-for="opt in scaleOptions"
              :key="opt.value"
              :label="opt.label"
              :value="opt.value"
            />
          </el-select>
          <span class="preview-width"
            >(约 {{ Math.round(originalImageWidth * (imageScale / 100)) }}px)</span
          >
        </div>
        <div class="setting-row">
          <span class="label">对齐方式：</span>
          <el-radio-group v-model="imageAlign">
            <el-radio-button value="left">居左</el-radio-button>
            <el-radio-button value="center">居中</el-radio-button>
            <el-radio-button value="right">居右</el-radio-button>
          </el-radio-group>
        </div>
      </div>
      <template #footer>
        <el-button @click="imageScaleVisible = false">取消</el-button>
        <el-button type="primary" @click="handleImageScaleConfirm">确定</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="previewVisible" title="预览" width="60%" append-to-body>
      <div class="preview-content" v-html="previewContent"></div>
      <template #footer>
        <el-button @click="previewVisible = false">关闭</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="expandVisible" title="编辑内容" fullscreen append-to-body>
      <div class="expand-editors">
        <div class="expand-editor-item">
          <h3>题目内容</h3>
          <MarkdownEditor
            ref="expandQuestionRef"
            v-model="expandQuestion"
            placeholder="请输入题目内容..."
            min-height="300px"
            :show-image-btn="true"
            :show-split-mode="true"
          />
        </div>
        <div class="expand-editor-item">
          <h3>答案</h3>
          <MarkdownEditor
            ref="expandAnswerRef"
            v-model="expandAnswer"
            placeholder="请输入答案..."
            min-height="200px"
            :show-split-mode="true"
          />
        </div>
        <div class="expand-editor-item">
          <h3>解析</h3>
          <MarkdownEditor
            ref="expandExplanationRef"
            v-model="expandExplanation"
            placeholder="请输入解析..."
            min-height="200px"
            :show-split-mode="true"
          />
        </div>
      </div>
      <template #footer>
        <el-button @click="expandVisible = false">取消</el-button>
        <el-button type="primary" @click="handleExpandSave">保存并返回</el-button>
      </template>
    </el-dialog>

    <el-image-viewer
      v-if="imagePreviewVisible"
      :url-list="[imagePreviewUrl]"
      @close="imagePreviewVisible = false"
    >
      <template #footer>
        <el-button
          circle
          type="danger"
          @click="(handleRemoveImage(0), (imagePreviewVisible = false))"
        >
          <template #icon><font-awesome-icon :icon="['fas', 'trash']" /></template>
        </el-button>
      </template>
    </el-image-viewer>
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

  .form-row {
    display: flex;
    gap: 16px;

    .flex-1 {
      flex: 1;
    }
  }

  .difficulty-slider {
    width: 100%;
    padding: 0 10px;
    margin-bottom: 8px;
  }
}

.image-form-item {
  margin-top: 16px;
  margin-bottom: 0;
}

.image-section {
  width: 100%;

  .image-list {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .image-item {
    position: relative;
    width: 100px;
    height: 100px;
    border-radius: 4px;
    overflow: hidden;
    border: 1px solid #dcdfe6;
    cursor: pointer;

    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    &:hover .image-remove {
      opacity: 1;
    }
  }

  .image-remove {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.6);
    display: flex;
    align-items: center;
    justify-content: center;
    color: #fff;
    opacity: 0;
    transition: opacity 0.2s;
  }

  .image-add {
    width: 100px;
    height: 100px;
    border: 2px dashed #dcdfe6;
    border-radius: 4px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    color: #909399;
    gap: 4px;
    transition: all 0.2s;

    &:hover {
      border-color: #409eff;
      color: #409eff;
      background: #f5f7fa;
    }

    span {
      font-size: 12px;
    }
  }

  .image-tip {
    font-size: 12px;
    color: #909399;
    margin-top: 8px;
  }
}

.original-image-form-item {
  margin-bottom: 16px;
  display: flex;
  align-items: flex-start;

  :deep(.el-form-item__label) {
    font-weight: 600;
    color: #303133;
    display: flex;
    align-items: center;
    height: 32px;
  }
}

.original-image-section {
  width: 100%;
}

.original-image-list {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.original-image-item {
  position: relative;
  display: inline-block;

  img {
    max-width: 300px;
    max-height: 200px;
    border-radius: 8px;
    border: 1px solid #dcdfe6;
    cursor: pointer;
    transition: transform 0.2s;

    &:hover {
      transform: scale(1.02);
    }
  }

  .original-image-actions {
    position: absolute;
    top: 8px;
    right: 8px;
    display: flex;
    gap: 4px;
    opacity: 0;
    transition: opacity 0.2s;
  }

  &:hover .original-image-actions {
    opacity: 1;
  }
}

.original-image-add {
  width: 150px;
  height: 100px;
  border: 2px dashed #dcdfe6;
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: #909399;
  gap: 8px;
  transition: all 0.2s;

  &:hover {
    border-color: #409eff;
    color: #409eff;
    background: #f5f7fa;
  }

  span {
    font-size: 13px;
  }
}

.image-viewer-actions {
  display: flex;
  gap: 8px;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

.preview-content {
  padding: 16px;
  min-height: 100px;
  font-size: 15px;
  line-height: 1.8;
  color: #303133;
  background: #fafafa;
  border-radius: 4px;

  :deep(img) {
    max-width: 100%;
    height: auto;
  }

  :deep(.ql-editor) {
    padding: 0;
  }
}

.preview-content {
  &.markdown-body {
    line-height: 1.8;

    .preview-section {
      margin-bottom: 24px;
      padding-bottom: 16px;
      border-bottom: 1px solid #ebeef5;

      &:last-child {
        margin-bottom: 0;
        padding-bottom: 0;
        border-bottom: none;
      }

      h3 {
        margin: 0 0 12px 0;
        color: #409eff;
        font-size: 16px;
      }

      p {
        margin-bottom: 12px;
      }

      ul,
      ol {
        padding-left: 24px;
        margin-bottom: 12px;
      }

      li {
        margin-bottom: 4px;
      }

      pre {
        background: #f6f8fa;
        padding: 12px;
        border-radius: 4px;
        overflow-x: auto;
      }

      code {
        background: #f6f8fa;
        padding: 2px 6px;
        border-radius: 3px;
        font-family: monospace;
      }

      blockquote {
        border-left: 4px solid #dfe2e5;
        padding-left: 16px;
        margin: 12px 0;
        color: #6a737d;
      }

      img {
        max-width: 100%;
      }

      table {
        border-collapse: collapse;
        width: 100%;
        margin-bottom: 12px;

        th,
        td {
          border: 1px solid #dfe2e5;
          padding: 8px 12px;
          text-align: left;
        }

        th {
          background: #f6f8fa;
        }
      }
    }
  }
}

.content-card {
  :deep(.el-card__body) {
    padding-bottom: 12px;
  }
}

.content-editors {
  display: flex;
  flex-direction: column;
  gap: 16px;

  .editor-section {
    h4 {
      margin: 0 0 8px 0;
      font-size: 14px;
      color: #303133;
      font-weight: 600;
    }
  }
}

.expand-editors {
  display: flex;
  flex-direction: column;
  gap: 16px;

  .expand-editor-item {
    h3 {
      margin: 0 0 8px 0;
      font-size: 14px;
      color: #303133;
    }
  }
}

.image-settings {
  .setting-row {
    display: flex;
    align-items: center;
    margin-bottom: 20px;

    .label {
      width: 80px;
      font-size: 14px;
      color: #606266;
    }

    .el-select {
      width: 120px;
    }

    .preview-width {
      margin-left: 12px;
      font-size: 13px;
      color: #909399;
    }
  }
}
</style>
