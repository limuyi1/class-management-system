<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import {
  ElCheckbox,
  ElButton,
  ElTag,
  ElEmpty,
  ElMessageBox,
  ElDialog,
  ElImageViewer
} from 'element-plus'
import { renderMarkdown } from '@/utils/katexUntil'
import type { WrongQuestion } from '@/types/WrongBook'

interface Props {
  questions: WrongQuestion[]
  selectedIds?: string[]
}

interface Emits {
  (e: 'edit', question: WrongQuestion): void
  (e: 'delete', id: string): void
  (e: 'toggle-favorite', id: string): void
  (e: 'selection-change', ids: string[]): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const localSelectedIds = ref<string[]>([])

watch(
  () => props.selectedIds,
  (newIds) => {
    if (newIds) {
      localSelectedIds.value = [...newIds]
    }
  },
  { immediate: true, deep: true }
)

const isAllSelected = computed(() => {
  return props.questions.length > 0 && localSelectedIds.value.length === props.questions.length
})

const handleSelectAll = (checked: any) => {
  if (checked) {
    localSelectedIds.value = props.questions.map((q) => q.id)
  } else {
    localSelectedIds.value = []
  }
  emit('selection-change', localSelectedIds.value)
}

const toggleSelect = (id: string, checked: any) => {
  if (checked) {
    if (!localSelectedIds.value.includes(id)) {
      localSelectedIds.value.push(id)
    }
  } else {
    localSelectedIds.value = localSelectedIds.value.filter((i) => i !== id)
  }
  emit('selection-change', localSelectedIds.value)
}

const handleEdit = (question: WrongQuestion) => {
  emit('edit', question)
}

const handleDelete = async (question: WrongQuestion) => {
  try {
    await ElMessageBox.confirm(`确定要删除这道错题吗？`, '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })
    emit('delete', question.id)
  } catch {
    // cancelled
  }
}

const handleToggleFavorite = (id: string) => {
  emit('toggle-favorite', id)
}

const handlePreview = (question: WrongQuestion) => {
  showDetail(question)
}

const getDifficultyStars = (difficulty?: number) => {
  const level = difficulty || 3
  return '★'.repeat(level) + '☆'.repeat(5 - level)
}

const getDifficultyType = (difficulty?: number) => {
  const level = difficulty || 3
  if (level <= 2) return 'success'
  if (level <= 3) return 'warning'
  return 'danger'
}

const formatDate = (dateStr: string) => {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  return date.toLocaleDateString('zh-CN')
}

const renderContent = (content: string) => {
  if (!content) return ''
  return renderMarkdown(content)
}

const detailVisible = ref(false)
const currentQuestion = ref<WrongQuestion | null>(null)

const showDetail = (question: WrongQuestion) => {
  currentQuestion.value = question
  detailVisible.value = true
}

const closeDetail = () => {
  detailVisible.value = false
  currentQuestion.value = null
}

const imagePreviewVisible = ref(false)
const imagePreviewUrl = ref('')

const handleImagePreview = (img: string) => {
  imagePreviewUrl.value = `data:image/png;base64,${img}`
  imagePreviewVisible.value = true
}
</script>

<template>
  <div class="question-list-container">
    <div class="question-header">
      <el-checkbox
        :model-value="isAllSelected"
        :indeterminate="localSelectedIds.length > 0 && localSelectedIds.length < questions.length"
        @change="handleSelectAll"
      >
        全选
      </el-checkbox>
      <span class="question-total">共 {{ questions.length }} 道题</span>
      <span v-if="localSelectedIds.length > 0" class="selected-count"
        >已选择 {{ localSelectedIds.length }} 道</span
      >
    </div>

    <el-empty v-if="questions.length === 0" description="暂无错题，点击右上角添加" />

    <el-scrollbar v-else>
      <div class="question-list">
        <div
          v-for="question in questions"
          :key="question.id"
          class="question-card"
          :class="{ favorite: question.isFavorite }"
        >
          <div class="question-checkbox" @click.stop>
            <el-checkbox
              :model-value="localSelectedIds.includes(question.id)"
              @change="toggleSelect(question.id, $event)"
            />
          </div>

          <div class="question-preview-btn" @click.stop>
            <el-button size="small" text @click="handlePreview(question)">
              <template #icon><font-awesome-icon :icon="['solid', 'eye']" /></template>
            </el-button>
          </div>

          <div
            class="question-content"
            @click.stop="toggleSelect(question.id, !localSelectedIds.includes(question.id))"
          >
            <div class="question-images" v-if="question.questionImages.length > 0">
              <div
                v-for="(img, idx) in question.questionImages.slice(0, 2)"
                :key="idx"
                class="question-image-wrapper"
              >
                <img :src="`data:image/jpeg;base64,${img}`" alt="题目图片" />
              </div>
              <div v-if="question.questionImages.length > 2" class="image-more">
                +{{ question.questionImages.length - 2 }}
              </div>
            </div>

            <div class="question-text">
              <div
                class="question-value"
                v-html="renderContent(question.questionText) || '暂无题目内容'"
              ></div>
            </div>

            <div class="question-answer" v-if="question.answer">
              <span class="answer-value" v-html="renderContent(question.answer)"></span>
            </div>

            <div class="question-meta">
              <el-tag v-if="question.questionType" size="small" type="info">
                {{ question.questionType }}
              </el-tag>
              <el-tag
                v-if="question.difficulty"
                size="small"
                :type="getDifficultyType(question.difficulty)"
              >
                {{ getDifficultyStars(question.difficulty) }}
              </el-tag>
              <span class="question-date">{{ formatDate(question.updatedAt) }}</span>
            </div>
          </div>

          <div class="question-actions" @click.stop>
            <el-button
              size="small"
              text
              :type="question.isFavorite ? 'warning' : 'default'"
              @click="handleToggleFavorite(question.id)"
            >
              <template #icon>
                <font-awesome-icon
                  :icon="['solid', question.isFavorite ? 'star' : 'star']"
                  :class="{ 'is-favorite': question.isFavorite }"
                />
              </template>
            </el-button>
            <el-button size="small" text @click="handleEdit(question)">
              <template #icon><font-awesome-icon :icon="['solid', 'pen']" /></template>
            </el-button>
            <el-button size="small" text type="danger" @click="handleDelete(question)">
              <template #icon><font-awesome-icon :icon="['solid', 'trash']" /></template>
            </el-button>
          </div>
        </div>
      </div>
    </el-scrollbar>

    <el-dialog
      v-model="detailVisible"
      :title="`错题详情 - ${currentQuestion?.questionType || '题目'}`"
      width="70%"
      destroy-on-close
    >
      <div class="detail-content" v-if="currentQuestion">
        <div class="detail-section" v-if="currentQuestion.questionImages.length > 0">
          <div class="detail-label">题目原始图片</div>
          <div class="detail-images">
            <div
              v-for="(img, idx) in currentQuestion.questionImages"
              :key="idx"
              class="detail-image-wrapper"
              @click="handleImagePreview(img)"
            >
              <img :src="`data:image/jpeg;base64,${img}`" alt="题目图片" />
            </div>
          </div>
        </div>

        <div class="detail-section">
          <div class="detail-label">题目内容</div>
          <div
            class="detail-text"
            v-html="renderContent(currentQuestion.questionText) || '暂无题目内容'"
          ></div>
        </div>

        <div class="detail-section" v-if="currentQuestion.answer">
          <div class="detail-label">答案</div>
          <div class="detail-answer" v-html="renderContent(currentQuestion.answer)"></div>
        </div>

        <div class="detail-section" v-if="currentQuestion.explanation">
          <div class="detail-label">解析</div>
          <div class="detail-explanation" v-html="renderContent(currentQuestion.explanation)"></div>
        </div>

        <div class="detail-meta">
          <el-tag v-if="currentQuestion.questionType" size="small" type="info">
            {{ currentQuestion.questionType }}
          </el-tag>
          <el-tag
            v-if="currentQuestion.difficulty"
            size="small"
            :type="getDifficultyType(currentQuestion.difficulty)"
          >
            难度: {{ getDifficultyStars(currentQuestion.difficulty) }}
          </el-tag>
          <span v-if="currentQuestion.source" class="detail-source"
            >来源: {{ currentQuestion.source }}</span
          >
          <span class="detail-date">更新时间: {{ formatDate(currentQuestion.updatedAt) }}</span>
        </div>
      </div>
      <template #footer>
        <div class="detail-footer">
          <el-button
            :type="currentQuestion?.isFavorite ? 'warning' : 'default'"
            @click="currentQuestion && handleToggleFavorite(currentQuestion.id)"
          >
            <template #icon><font-awesome-icon :icon="['solid', 'star']" /></template>
            {{ currentQuestion?.isFavorite ? '取消收藏' : '收藏' }}
          </el-button>
          <el-button
            type="primary"
            @click="currentQuestion && ((detailVisible = false), handleEdit(currentQuestion))"
          >
            <template #icon><font-awesome-icon :icon="['solid', 'pen']" /></template>
            编辑
          </el-button>
          <el-button type="danger" @click="currentQuestion && handleDelete(currentQuestion)">
            <template #icon><font-awesome-icon :icon="['solid', 'trash']" /></template>
            删除
          </el-button>
          <el-button @click="closeDetail">关闭</el-button>
        </div>
      </template>
    </el-dialog>

    <el-image-viewer
      v-if="imagePreviewVisible"
      :url-list="[imagePreviewUrl]"
      @close="imagePreviewVisible = false"
    />
  </div>
</template>

<style scoped lang="scss">
.question-list-container {
  height: 100%;
  background: #fff;
  border-radius: 8px;
  padding: 12px;
  display: flex;
  flex-direction: column;
}

.question-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding-bottom: 12px;
  border-bottom: 1px solid #eee;
  margin-bottom: 12px;
  flex-wrap: wrap;
}

.question-total {
  color: #909399;
  font-size: 14px;
}

.selected-count {
  color: #409eff;
  font-size: 14px;
  margin-left: auto;
}

.question-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 12px;
}

.question-card {
  display: flex;
  flex-direction: column;
  padding: 12px;
  border: 1px solid #eee;
  border-radius: 8px;
  transition: all 0.2s;
  cursor: pointer;
  min-height: 180px;
  position: relative;

  &:hover {
    border-color: #409eff;
    box-shadow: 0 2px 8px rgba(64, 158, 255, 0.1);

    .question-actions {
      display: flex;
      justify-content: flex-end;
      opacity: 1;
    }
  }

  &.favorite {
    border-color: #e6a23c;
    background: #fdf6ec;
  }
}

.question-checkbox {
  margin-bottom: 8px;
}

.question-preview-btn {
  position: absolute;
  top: 8px;
  right: 8px;
  z-index: 1;
}

.question-content {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.question-images {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 8px;
}

.question-image-wrapper {
  width: 50px;
  height: 50px;
  border-radius: 4px;
  overflow: hidden;
  border: 1px solid #ddd;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
}

.image-more {
  width: 50px;
  height: 50px;
  border-radius: 4px;
  background: #f0f0f0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  color: #666;
}

.question-text {
  flex: 1;
  margin-bottom: 8px;
  overflow: hidden;
}

.question-value {
  color: #333;
  line-height: 1.6;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
  word-break: break-word;
}

.question-answer {
  margin-bottom: 8px;
  padding: 8px;
  background: #f5f7fa;
  border-radius: 4px;

  .answer-value {
    color: #67c23a;
    font-weight: 500;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
}

.question-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.question-source {
  color: #909399;
  font-size: 12px;
}

.question-date {
  color: #6b7280;
  font-size: 12px;
}

.question-actions {
  display: flex;
  flex-direction: row;
  gap: 4px;
  opacity: 0;
  transition: opacity 0.2s;
  flex-shrink: 0;
  align-items: center;
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid #eee;
}

.is-favorite {
  color: #e6a23c;
}

.detail-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.detail-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.detail-label {
  color: #909399;
  font-size: 14px;
  font-weight: 500;
}

.detail-images {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.detail-image-wrapper {
  max-width: 300px;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid #eee;
  cursor: pointer;
  transition: transform 0.2s;

  &:hover {
    transform: scale(1.02);
  }

  img {
    width: 100%;
    height: auto;
  }
}

.detail-text {
  color: #333;
  line-height: 1.8;
  padding: 12px;
  background: #f9f9f9;
  border-radius: 4px;
}

.detail-answer {
  color: #67c23a;
  font-weight: 500;
  line-height: 1.8;
  padding: 12px;
  background: #f0f9eb;
  border-radius: 4px;
}

.detail-explanation {
  color: #409eff;
  line-height: 1.8;
  padding: 12px;
  background: #ecf5ff;
  border-radius: 4px;
}

.detail-meta {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  padding-top: 16px;
  border-top: 1px solid #eee;
}

.detail-source {
  color: #909399;
  font-size: 14px;
}

.detail-date {
  color: #6b7280;
  font-size: 14px;
}

.detail-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>
