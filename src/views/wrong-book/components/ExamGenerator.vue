<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { storeToRefs } from 'pinia'
import {
  ElDialog,
  ElForm,
  ElFormItem,
  ElInput,
  ElCheckbox,
  ElButton,
  ElMessage,
} from 'element-plus'
import { runWithLoading } from '@/hooks/useLoading'
import { useWrongBookStore } from '@/stores/wrong-book'
import { PagesEnum } from '@/types/Common'
import { exportPDF } from '@/utils/pdfUtil'
import { renderKatex } from '@/utils/katexUtil'
import type { WrongQuestion } from '@/types/WrongBook'

interface Props {
  visible: boolean
  questionIds: string[]
  allQuestions?: WrongQuestion[]
}

interface Emits {
  (e: 'update:visible', value: boolean): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const wrongBookStore = useWrongBookStore()
const { favoriteQuestions } = storeToRefs(wrongBookStore)

const selectedQuestions = ref<string[]>([])
const examTitle = ref('错题练习')
const className = ref('')
const includeAnswer = ref(true)
const pageType = ref<PagesEnum>(PagesEnum.A4)

const previewRefs = ref<HTMLElement[]>([])

watch(
  () => props.questionIds,
  (ids) => {
    selectedQuestions.value = [...ids]
  },
  { immediate: true }
)

const availableQuestions = computed(() => {
  if (props.allQuestions && props.allQuestions.length > 0) {
    return props.allQuestions
  }
  return favoriteQuestions.value
})

const favoriteQuestionsList = computed(() => availableQuestions.value)
const selectedQuestionList = computed(() => {
  return selectedQuestions.value
    .map((id) => favoriteQuestionsList.value.find((q) => q.id === id))
    .filter((q): q is WrongQuestion => q !== undefined)
})

const handleClose = () => {
  emit('update:visible', false)
}

const handleExport = async () => {
  if (selectedQuestions.value.length === 0) {
    ElMessage.warning('请选择要导出的题目')
    return
  }

  const elements = document.querySelectorAll('.exam-question-item')
  if (elements.length === 0) {
    ElMessage.warning('没有可导出的题目')
    return
  }

  const fileName = `${examTitle.value || '错题试卷'}_${new Date().toLocaleDateString()}.pdf`
  const result = await runWithLoading('正在导出PDF...', async () => {
    return await exportPDF(elements, pageType.value, 4, fileName)
  })
  if (!result.success) {
    ElMessage.error(result.error?.message || '导出失败！')
    return
  }
  ElMessage.success('导出成功')
}

const setRefs = (el: HTMLElement | null, index: number) => {
  if (el) {
    previewRefs.value[index] = el
  }
}

const handleSelectAll = () => {
  if (selectedQuestions.value.length === favoriteQuestionsList.value.length) {
    selectedQuestions.value = []
  } else {
    selectedQuestions.value = favoriteQuestionsList.value.map((q) => q.id)
  }
}

const toggleQuestionSelect = (id: string) => {
  if (selectedQuestions.value.includes(id)) {
    selectedQuestions.value = selectedQuestions.value.filter((i) => i !== id)
  } else {
    selectedQuestions.value.push(id)
  }
}

const renderContent = (content: string) => {
  if (!content) return ''
  return renderKatex(content)
}
</script>

<template>
  <el-dialog
    :model-value="visible"
    title="生成试卷"
    width="900px"
    :close-on-click-modal="false"
    @update:model-value="(val) => emit('update:visible', val)"
  >
    <div class="exam-generator">
      <div class="exam-settings">
        <el-form inline>
          <el-form-item label="试卷标题">
            <el-input v-model="examTitle" placeholder="如：错题练习" style="width: 150px" />
          </el-form-item>
          <el-form-item label="班级">
            <el-input v-model="className" placeholder="如：三年级一班" style="width: 120px" />
          </el-form-item>
          <el-form-item label="页面尺寸">
            <el-select v-model="pageType" style="width: 100px">
              <el-option label="A4" :value="PagesEnum.A4" />
              <el-option label="A3" :value="PagesEnum.A3" />
              <el-option label="B4" :value="PagesEnum.B4" />
              <el-option label="B3" :value="PagesEnum.B3" />
            </el-select>
          </el-form-item>
          <el-form-item label="包含答案">
            <el-switch v-model="includeAnswer" />
          </el-form-item>
        </el-form>
      </div>

      <div class="exam-questions">
        <div class="questions-header">
          <span>选择题目（共 {{ favoriteQuestionsList.length }} 道收藏题）</span>
          <el-checkbox
            :model-value="
              selectedQuestions.length === favoriteQuestionsList.length &&
              favoriteQuestionsList.length > 0
            "
            :indeterminate="
              selectedQuestions.length > 0 &&
              selectedQuestions.length < favoriteQuestionsList.length
            "
            @change="handleSelectAll"
          >
            全选
          </el-checkbox>
        </div>
        <el-scrollbar max-height="300px">
          <div class="question-checkboxes">
            <div
              v-for="question in favoriteQuestionsList"
              :key="question.id"
              class="question-checkbox-item"
              @click="toggleQuestionSelect(question.id)"
            >
              <el-checkbox
                :model-value="selectedQuestions.includes(question.id)"
                @change="toggleQuestionSelect(question.id)"
              />
              <div class="question-preview">
                <span class="question-type">{{ question.questionType || '其他' }}</span>
                <span
                  class="question-text"
                  v-html="
                    renderContent(question.questionText).slice(0, 50) +
                    (renderContent(question.questionText).length > 50 ? '...' : '')
                  "
                ></span>
              </div>
            </div>
          </div>
        </el-scrollbar>
      </div>

      <div class="exam-preview">
        <div class="preview-header">预览</div>
        <el-scrollbar max-height="400px">
          <div class="preview-content">
            <div class="preview-sheet">
              <div class="sheet-header">
                <h2>{{ examTitle || '错题练习' }}</h2>
                <div class="sheet-info">
                  <span>班级：{{ className || '___' }}</span>
                  <span>姓名：___</span>
                  <span>得分：___</span>
                </div>
              </div>

              <div class="sheet-questions">
                <div
                  v-for="(question, index) in selectedQuestionList"
                  :key="question.id"
                  :ref="(el) => setRefs(el as HTMLElement, index)"
                  class="exam-question-item"
                >
                  <div class="question-number">{{ index + 1 }}.</div>
                  <div class="question-main">
                    <div
                      class="question-content"
                      v-html="renderContent(question.questionText)"
                    ></div>
                  </div>
                </div>

                <div v-if="includeAnswer && selectedQuestionList.length > 0" class="answer-section">
                  <div class="answer-header">答案</div>
                  <div
                    v-for="(question, index) in selectedQuestionList"
                    :key="`answer-${question.id}`"
                    class="answer-item"
                  >
                    <span class="answer-number">{{ index + 1 }}.</span>
                    <span class="answer-content" v-html="renderContent(question.answer)"></span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </el-scrollbar>
      </div>
    </div>

    <template #footer>
      <el-button @click="handleClose">取消</el-button>
      <el-button type="primary" :disabled="selectedQuestions.length === 0" @click="handleExport">
        导出 PDF
      </el-button>
    </template>
  </el-dialog>
</template>

<style scoped lang="scss">
.exam-generator {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.exam-settings {
  padding: 12px;
  background: #f5f7fa;
  border-radius: 8px;
}

.exam-questions {
  .questions-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 12px;
    color: #333;
    font-weight: 500;
  }
}

.question-checkboxes {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.question-checkbox-item {
  padding: 8px;
  border: 1px solid #eee;
  border-radius: 4px;
  margin-right: 0 !important;

  &:hover {
    background: #f5f7fa;
  }
}

.question-preview {
  display: flex;
  align-items: center;
  gap: 8px;
  max-width: 100%;

  .question-type {
    flex-shrink: 0;
    font-size: 12px;
    color: #909399;
    background: #f0f0f0;
    padding: 2px 6px;
    border-radius: 4px;
  }

  .question-text {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: #333;
  }
}

.exam-preview {
  border: 1px solid #eee;
  border-radius: 8px;
  overflow: hidden;

  .preview-header {
    padding: 8px 12px;
    background: #f5f7fa;
    border-bottom: 1px solid #eee;
    font-weight: 500;
  }
}

.preview-content {
  padding: 20px;
  background: #fff;
}

.preview-sheet {
  background: #fff;
  padding: 20px;
  min-height: 500px;
}

.sheet-header {
  text-align: center;
  margin-bottom: 20px;
  padding-bottom: 12px;
  border-bottom: 2px solid #333;

  h2 {
    margin: 0 0 12px 0;
    font-size: 20px;
  }

  .sheet-info {
    display: flex;
    justify-content: center;
    gap: 24px;
    font-size: 14px;
    color: #666;
  }
}

.sheet-questions {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.exam-question-item {
  display: flex;
  gap: 12px;
  page-break-inside: avoid;
}

.question-number {
  font-weight: 600;
  font-size: 16px;
  width: 30px;
  flex-shrink: 0;
}

.question-main {
  flex: 1;
}

.question-images {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 8px;

  img {
    max-width: 200px;
    max-height: 150px;
    border: 1px solid #eee;
    border-radius: 4px;
  }
}

.question-content {
  line-height: 1.8;
  white-space: pre-wrap;
}

.answer-section {
  margin-top: 30px;
  padding-top: 20px;
  border-top: 2px solid #eee;
}

.answer-header {
  font-weight: 600;
  font-size: 16px;
  margin-bottom: 12px;
  color: #333;
}

.answer-item {
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
  line-height: 1.6;
}

.answer-number {
  font-weight: 500;
  color: #67c23a;
}

.answer-content {
  color: #67c23a;
}
</style>
