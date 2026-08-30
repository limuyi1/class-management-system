<script setup lang="ts">
import { ref, watch } from 'vue'
import { ElDialog, ElButton } from 'element-plus'
import MarkdownEditor from '@/components/MarkdownEditor.vue'

/** 弹窗可见性与三个编辑器的初始内容 */
interface Props {
  visible: boolean
  questionText: string
  answer: string
  explanation: string
}

const props = defineProps<Props>()

/** 可见性与三个字段内容的更新事件 */
const emit = defineEmits<{
  'update:visible': [value: boolean]
  'update:questionText': [value: string]
  'update:answer': [value: string]
  'update:explanation': [value: string]
}>()

// 展开编辑时的本地草稿，保存时回写父组件
const expandQuestion = ref('')
const expandAnswer = ref('')
const expandExplanation = ref('')
const expandQuestionRef = ref<InstanceType<typeof MarkdownEditor> | null>(null)
const expandAnswerRef = ref<InstanceType<typeof MarkdownEditor> | null>(null)
const expandExplanationRef = ref<InstanceType<typeof MarkdownEditor> | null>(null)

// 打开弹窗时用当前内容初始化各编辑器的草稿
watch(
  () => props.visible,
  (isVisible) => {
    if (isVisible) {
      expandQuestion.value = props.questionText
      expandAnswer.value = props.answer
      expandExplanation.value = props.explanation
    }
  }
)

/** 将三个编辑器的内容保存回父组件并关闭弹窗 */
const handleSave = () => {
  emit('update:questionText', expandQuestionRef.value?.getContent?.() || '')
  emit('update:answer', expandAnswerRef.value?.getContent?.() || '')
  emit('update:explanation', expandExplanationRef.value?.getContent?.() || '')
  emit('update:visible', false)
}
</script>

<template>
  <el-dialog
    :model-value="visible"
    title="编辑内容"
    fullscreen
    append-to-body
    @update:model-value="(val) => emit('update:visible', val)"
  >
    <!-- 全屏展开的题目 / 答案 / 解析编辑器 -->
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
      <el-button @click="emit('update:visible', false)">取消</el-button>
      <el-button type="primary" @click="handleSave">保存并返回</el-button>
    </template>
  </el-dialog>
</template>

<style scoped lang="scss">
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
</style>
