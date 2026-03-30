<script setup lang="ts">
import { ref, computed } from 'vue'
import { ElPopover, ElButton } from 'element-plus'
import { QuillEditor } from '@vueup/vue-quill'
import '@vueup/vue-quill/dist/vue-quill.snow.css'
import FormulaToolbar from '@/views/wrong-book/components/FormulaToolbar.vue'

interface Props {
  modelValue?: string
  placeholder?: string
  minHeight?: string
  showImageBtn?: boolean
  showFormulaBtn?: boolean
  showPreview?: boolean
  showExpand?: boolean
  disabled?: boolean
}

interface Emits {
  (e: 'update:modelValue', value: string): void
  (e: 'insertImage'): void
  (e: 'insertFormula', formula: string): void
  (e: 'preview'): void
  (e: 'expand'): void
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: '',
  placeholder: '请输入...',
  minHeight: '100px',
  showImageBtn: false,
  showFormulaBtn: true,
  showPreview: false,
  showExpand: false,
  disabled: false
})

const emit = defineEmits<Emits>()

const editorRef = ref<InstanceType<typeof QuillEditor> | null>(null)

const content = computed({
  get: () => props.modelValue,
  set: (value: string) => emit('update:modelValue', value)
})

const editorOptions = computed(() => ({
  modules: {
    toolbar: {
      container: [
        ['bold', 'italic', 'underline', 'strike'],
        ['blockquote', 'code-block'],
        [{ list: 'ordered' }, { list: 'bullet' }],
        [{ header: [1, 2, 3, false] }],
        [{ color: [] }, { background: [] }],
        ['clean']
      ],
      handlers: {
        image: () => {
          emit('insertImage')
        }
      }
    }
  },
  placeholder: props.placeholder,
  readOnly: props.disabled
}))

const handleInsertFormula = (formula: string) => {
  const quill = editorRef.value?.getQuill()
  if (quill) {
    const range = quill.getSelection()
    const index = range ? range.index : quill.getLength()
    quill.insertText(index, formula)
    quill.setSelection(index + formula.length)
  }
  emit('insertFormula', formula)
}

const getQuill = () => {
  return editorRef.value?.getQuill() ?? null
}

defineExpose({
  getQuill
})
</script>

<template>
  <div class="rich-text-editor">
    <div class="editor-toolbar">
      <div class="toolbar-left">
        <el-button
          v-if="showImageBtn"
          size="small"
          title="插入图片"
          :disabled="disabled"
          @click="emit('insertImage')"
        >
          <template #icon><font-awesome-icon :icon="['fas', 'image']" /></template>
          <span>图片</span>
        </el-button>
        <el-popover
          v-if="showFormulaBtn"
          placement="bottom-start"
          :width="360"
          trigger="click"
          popper-class="formula-popover"
        >
          <template #reference>
            <el-button size="small" title="插入公式" :disabled="disabled">
              <template #icon><font-awesome-icon :icon="['fas', 'function']" /></template>
              <span>公式</span>
            </el-button>
          </template>
          <FormulaToolbar @insert="handleInsertFormula" />
        </el-popover>
      </div>
      <div class="toolbar-right">
        <el-button
          v-if="showPreview"
          size="small"
          title="预览"
          :disabled="disabled"
          @click="emit('preview')"
        >
          <template #icon><font-awesome-icon :icon="['fas', 'eye']" /></template>
          <span>预览</span>
        </el-button>
        <el-button
          v-if="showExpand"
          size="small"
          title="扩大编辑"
          type="primary"
          :disabled="disabled"
          @click="emit('expand')"
        >
          <template #icon><font-awesome-icon :icon="['fas', 'expand']" /></template>
          <span>扩大</span>
        </el-button>
      </div>
    </div>
    <div class="editor-container" :style="{ minHeight }">
      <QuillEditor
        ref="editorRef"
        v-model:content="content"
        content-type="html"
        :options="editorOptions"
      />
    </div>
  </div>
</template>

<style scoped lang="scss">
.rich-text-editor {
  width: 100%;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  overflow: hidden;

  .editor-toolbar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 12px;
    background: #fafafa;
    border-bottom: 1px solid #e4e7ed;

    .toolbar-left,
    .toolbar-right {
      display: flex;
      gap: 8px;
    }
  }

  .editor-container {
    :deep(.ql-container) {
      min-height: v-bind(minHeight);
      font-size: 14px;
    }

    :deep(.ql-toolbar) {
      border: none;
      border-bottom: 1px solid #e4e7ed;
    }

    :deep(.ql-container.ql-snow) {
      border: none;
    }

    :deep(.ql-editor) {
      min-height: v-bind(minHeight);
    }
  }
}
</style>

<style lang="scss">
.formula-popover {
  padding: 0 !important;
}
</style>
