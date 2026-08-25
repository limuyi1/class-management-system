<script setup lang="ts">
import { ref, computed } from 'vue'
import { ElPopover } from 'element-plus'
import { MdEditor, NormalToolbar } from 'md-editor-v3'
import type { ToolbarNames } from 'md-editor-v3'
import 'md-editor-v3/lib/style.css'
import FormulaToolbar from '@/views/wrong-book/components/FormulaToolbar.vue'
import type { MarkdownEditorProps, MarkdownEditorEmits } from '@/types/MarkdownEditor'

/**
 * Markdown 编辑器组件。
 *
 * 基于 md-editor-v3 封装，内置图片与公式插入入口，
 * 通过 v-model 双向同步内容，并对外暴露内容读取与全屏切换方法。
 */
const props = withDefaults(defineProps<MarkdownEditorProps>(), {
  modelValue: '',
  placeholder: '请输入...',
  minHeight: '100px',
  showImageBtn: true,
  showFormulaBtn: true,
  showPreview: false,
  showExpand: false,
  showSplitMode: false,
  disabled: false
})

const emit = defineEmits<MarkdownEditorEmits>()

// 0、1 为自定义工具栏占位，分别对应图片与公式按钮，配合 #defToolbars 插槽渲染
const toolbars: ToolbarNames[] = [
  'bold',
  'italic',
  '-',
  'title',
  'quote',
  'unorderedList',
  'orderedList',
  '-',
  'revoke',
  'next',
  '-',
  0, // 图片
  1, // 公式
  '=',
  'prettier',
  'preview',
  'previewOnly',
  'htmlPreview'
] as ToolbarNames[]

/** 编辑器内容的 v-model 双向绑定代理 */
const content = computed({
  get: () => props.modelValue,
  set: (value: string) => emit('update:modelValue', value)
})

/** 预览弹窗中渲染的 HTML 内容 */
const previewContent = ref('')
/** 预览弹窗是否可见 */
const previewVisible = ref(false)

/**
 * 将选中的公式追加到正文末尾
 * @param formula - 待插入的公式文本
 */
const handleInsertFormula = (formula: string) => {
  content.value += formula
  emit('insertFormula', formula)
}

/** 编辑器组件实例引用 */
const editorRef = ref<InstanceType<typeof MdEditor> | null>(null)

/**
 * 切换编辑器全屏状态，兼容不同版本的 API 命名
 */
const handleToggleFullscreen = () => {
  const editor = editorRef.value as unknown as
    | {
        toggleFullscreen?: () => void
        pageFullscreen?: () => void
      }
    | null

  if (!editor) return
  if (editor.toggleFullscreen) {
    editor.toggleFullscreen()
    return
  }
  editor.pageFullscreen?.()
}

// 对外暴露内容读取与全屏切换方法
defineExpose({
  getContent: () => content.value,
  toggleFullscreen: handleToggleFullscreen
})
</script>

<template>
  <div class="markdown-editor">
    <MdEditor
      ref="editorRef"
      v-model="content"
      :language="'zh-CN'"
      :preview="showSplitMode"
      :input-box-width="showSplitMode ? '50%' : '100%'"
      :style="{ minHeight }"
      :toolbars="toolbars"
      :autofocus="false"
    >
      <template #defToolbars>
        <!-- 自定义工具栏入口：插入图片 -->
        <NormalToolbar v-if="showImageBtn" title="插入图片" @onClick="emit('insertImage')">
          <font-awesome-icon :icon="['fas', 'image']" />
        </NormalToolbar>
        <!-- 自定义工具栏入口：插入公式 -->
        <el-popover
          v-if="showFormulaBtn"
          placement="bottom-start"
          :width="360"
          trigger="click"
          popper-class="formula-popover"
        >
          <template #reference>
            <NormalToolbar title="插入公式">
              <font-awesome-icon :icon="['fas', 'divide']" />
            </NormalToolbar>
          </template>
          <FormulaToolbar @insert="handleInsertFormula" />
        </el-popover>
      </template>
    </MdEditor>

    <!-- 预览弹窗 -->
    <el-dialog v-model="previewVisible" title="预览" width="60%" append-to-body>
      <div class="preview-content markdown-body" v-html="previewContent"></div>
      <template #footer>
        <el-button @click="previewVisible = false">关闭</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped lang="scss">
.markdown-editor {
  width: 100%;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  overflow: hidden;

  :deep(.md-editor) {
    --md-bk-color: transparent;
    border: none;
  }

  :deep(.md-editor-main) {
    min-height: v-bind(minHeight);
  }

  :deep(.md-editor-catalog) {
    display: none;
  }

  :deep(.normal-toolbar) {
    font-size: 14px;
  }
}

.preview-content {
  padding: 16px;
  max-height: 60vh;
  overflow-y: auto;

  &.markdown-body {
    line-height: 1.8;

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

    h1,
    h2,
    h3,
    h4,
    h5,
    h6 {
      margin-top: 20px;
      margin-bottom: 12px;
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
</style>

<style lang="scss">
.formula-popover {
  padding: 0 !important;
}
</style>
