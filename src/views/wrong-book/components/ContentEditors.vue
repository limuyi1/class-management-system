<script setup lang="ts">
import { ref } from 'vue'
import MarkdownEditor from '@/components/MarkdownEditor.vue'

interface Props {
  questionText: string
  answer: string
  explanation: string
}

defineProps<Props>()

const emit = defineEmits<{
  'update:questionText': [value: string]
  'update:answer': [value: string]
  'update:explanation': [value: string]
  'insert-image': []
  'set-active-editor': [field: 'question' | 'answer' | 'explanation']
}>()

const questionEditorRef = ref<InstanceType<typeof MarkdownEditor> | null>(null)
const answerEditorRef = ref<InstanceType<typeof MarkdownEditor> | null>(null)
const explanationEditorRef = ref<InstanceType<typeof MarkdownEditor> | null>(null)

const handleInsertImage = () => {
  emit('insert-image')
}

const handleSetActiveEditor = (field: 'question' | 'answer' | 'explanation') => {
  emit('set-active-editor', field)
}

defineExpose({
  questionEditorRef,
  answerEditorRef,
  explanationEditorRef
})
</script>

<template>
  <div class="content-editors">
    <div class="editor-section">
      <h4>题目内容</h4>
      <MarkdownEditor
        ref="questionEditorRef"
        :model-value="questionText"
        placeholder="请输入题目内容..."
        :show-preview="false"
        :show-split-mode="true"
        @update:model-value="(val) => emit('update:questionText', val)"
        @click="handleSetActiveEditor('question')"
        @insert-image="handleInsertImage"
      />
    </div>
    <div class="editor-section">
      <h4>答案</h4>
      <MarkdownEditor
        ref="answerEditorRef"
        :model-value="answer"
        placeholder="请输入答案..."
        :show-preview="false"
        :show-split-mode="true"
        @update:model-value="(val) => emit('update:answer', val)"
        @click="handleSetActiveEditor('answer')"
      />
    </div>
    <div class="editor-section">
      <h4>解析</h4>
      <MarkdownEditor
        ref="explanationEditorRef"
        :model-value="explanation"
        placeholder="请输入解析..."
        :show-preview="false"
        :show-split-mode="true"
        @update:model-value="(val) => emit('update:explanation', val)"
        @click="handleSetActiveEditor('explanation')"
      />
    </div>
  </div>
</template>

<style scoped lang="scss">
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
</style>
