<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'

import ExcelHeaderRowPicker from '@/views/setting/components/import/ExcelHeaderRowPicker.vue'
import { buildExcelCommentWorkspace } from '@/utils/commentWorkspaceExcelUntil'
import { buildExcelDataFromHeaderRow, parseExcelPreview } from '@/utils/xlsxUntil'

import type { UploadFile, UploadFiles, UploadInstance } from 'element-plus'
import type { ExcelCommentImportSelectionType } from '@/types/CommentWorkspace'
import type { ExcelPreviewResultType } from '@/utils/xlsxUntil'

const visible = defineModel<boolean>({ required: true })

const emit = defineEmits<{
  confirm: [value: ExcelCommentImportSelectionType & ReturnType<typeof buildExcelCommentWorkspace>]
}>()

const uploadRef = ref<UploadInstance>()
const preview = ref<ExcelPreviewResultType | null>(null)
const sourceFile = ref<File | null>(null)
const fileName = ref('')
const loading = ref(false)
const headerRowIndex = ref(0)
const nameColumn = ref('')
const commentColumn = ref('')
const tagColumn = ref('')

const parsedData = computed(() => {
  if (!preview.value) return { header: [], data: [] }
  return buildExcelDataFromHeaderRow(preview.value.rows, headerRowIndex.value)
})

const availableCommentColumns = computed(() =>
  parsedData.value.header.filter(
    (header) => header !== nameColumn.value && header !== tagColumn.value
  )
)
const availableTagColumns = computed(() =>
  parsedData.value.header.filter(
    (header) => header !== nameColumn.value && header !== commentColumn.value
  )
)

const findSuggestedColumn = (patterns: string[]): string =>
  parsedData.value.header.find((header) => patterns.some((pattern) => header.includes(pattern))) ||
  ''

const resetSelections = (): void => {
  nameColumn.value = findSuggestedColumn(['姓名', '学生姓名', '学生', '名字'])
  commentColumn.value = findSuggestedColumn(['期末评语', '评语'])
  tagColumn.value = findSuggestedColumn(['标签', '特点', '关键词'])
}

const resetDialog = (): void => {
  uploadRef.value?.clearFiles()
  preview.value = null
  sourceFile.value = null
  fileName.value = ''
  headerRowIndex.value = 0
  nameColumn.value = ''
  commentColumn.value = ''
  tagColumn.value = ''
}

const handleFileChange = async (file: UploadFile, files: UploadFiles): Promise<void> => {
  void files
  if (!file.raw) return
  loading.value = true
  try {
    preview.value = await parseExcelPreview(file)
    sourceFile.value = file.raw
    fileName.value = file.name
    headerRowIndex.value = preview.value.suggestedHeaderRowIndex
    resetSelections()
  } catch (error) {
    console.error('读取临时评语 Excel 失败:', error)
    ElMessage.error('Excel 读取失败，请检查文件格式')
  } finally {
    loading.value = false
  }
}

const handleConfirm = (): void => {
  if (!preview.value || !sourceFile.value) {
    ElMessage.warning('请先选择 Excel 文件')
    return
  }
  if (!nameColumn.value) {
    ElMessage.warning('请选择姓名列')
    return
  }

  const workspace = buildExcelCommentWorkspace({
    rows: preview.value.rows,
    headerRowIndex: headerRowIndex.value,
    nameColumn: nameColumn.value,
    commentColumn: commentColumn.value || undefined,
    tagColumn: tagColumn.value || undefined
  })
  if (!workspace.students.length) {
    ElMessage.warning('所选姓名列中没有可处理的数据')
    return
  }

  emit('confirm', {
    file: sourceFile.value,
    fileName: fileName.value,
    rows: preview.value.rows,
    merges: preview.value.merges,
    headerRowIndex: headerRowIndex.value,
    nameColumn: nameColumn.value,
    commentColumn: commentColumn.value || undefined,
    tagColumn: tagColumn.value || undefined,
    ...workspace
  })
  visible.value = false
}

watch(headerRowIndex, () => {
  if (preview.value) resetSelections()
})

watch(nameColumn, (column) => {
  if (commentColumn.value === column) commentColumn.value = ''
  if (tagColumn.value === column) tagColumn.value = ''
})

watch(commentColumn, (column) => {
  if (tagColumn.value === column) tagColumn.value = ''
})

watch(visible, (value) => {
  if (value) resetDialog()
})
</script>

<template>
  <el-dialog v-model="visible" title="导入临时评语数据" width="900px" :close-on-click-modal="false">
    <div v-loading="loading" class="comment-excel-import">
      <el-alert
        title="本次 Excel 数据仅在当前页面使用，不会匹配或写入系统学生、评语和标签。"
        type="info"
        show-icon
        :closable="false"
      />
      <el-upload
        ref="uploadRef"
        drag
        accept=".xlsx,.xls"
        :auto-upload="false"
        :limit="1"
        :on-change="handleFileChange"
      >
        <font-awesome-icon :icon="['solid', 'file-excel']" />
        <div>{{ fileName || '选择或拖入 Excel 文件' }}</div>
      </el-upload>

      <template v-if="preview">
        <excel-header-row-picker
          v-model="headerRowIndex"
          :rows="preview.rows"
          :merges="preview.merges"
        />

        <div class="column-grid">
          <label>
            <strong>姓名列</strong><span>必选，每一行独立处理</span>
            <el-select v-model="nameColumn" placeholder="选择姓名列">
              <el-option
                v-for="header in parsedData.header"
                :key="header"
                :label="header"
                :value="header"
              />
            </el-select>
          </label>
          <label>
            <strong>评语列</strong><span>可选；未选择时导出会新增</span>
            <el-select v-model="commentColumn" clearable placeholder="选择评语列">
              <el-option
                v-for="header in availableCommentColumns"
                :key="header"
                :label="header"
                :value="header"
              />
            </el-select>
          </label>
          <label>
            <strong>标签列</strong><span>可选；仅作为本次 AI 上下文</span>
            <el-select v-model="tagColumn" clearable placeholder="选择标签列">
              <el-option
                v-for="header in availableTagColumns"
                :key="header"
                :label="header"
                :value="header"
              />
            </el-select>
          </label>
        </div>
      </template>
    </div>

    <template #footer>
      <el-button @click="visible = false">取消</el-button>
      <el-button type="primary" @click="handleConfirm">进入评语处理</el-button>
    </template>
  </el-dialog>
</template>

<style scoped lang="scss">
.comment-excel-import {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.column-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;

  label {
    display: flex;
    flex-direction: column;
    gap: 7px;
    padding: 14px;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
  }

  strong {
    color: #1f2937;
    font-size: 14px;
  }

  span {
    min-height: 18px;
    color: #64748b;
    font-size: 12px;
  }
}
</style>
