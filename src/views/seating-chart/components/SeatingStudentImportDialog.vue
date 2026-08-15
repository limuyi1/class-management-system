<script setup lang="ts">
import { shallowRef, watch } from 'vue'
import { ElMessage } from 'element-plus'

import ExcelFileDropzone from '@/components/excel/ExcelFileDropzone.vue'
import { useExcelPreviewImport } from '@/hooks/useExcelPreviewImport'
import ExcelHeaderRowPicker from '@/views/setting/components/import/ExcelHeaderRowPicker.vue'
import { buildExcelSeatingStudents } from '@/utils/seating-chart/seatingChartStudentUtil'

import type { UploadFile } from 'element-plus'
import type { ExcelStudentSourceType } from '@/types/StudentSource'

const visible = defineModel<boolean>({ required: true })

const emit = defineEmits<{
  confirm: [source: ExcelStudentSourceType]
}>()

// 公共层维护文件与表头预览；座位表只选择姓名列并生成自己的名单快照。
const { fileName, headerRowIndex, loading, parsedData, preview, parseFile, reset } =
  useExcelPreviewImport({ errorLogLabel: '读取座位表 Excel' })
const nameColumn = shallowRef('')

const findSuggestedNameColumn = (): string =>
  parsedData.value.header.find((header) =>
    ['姓名', '学生姓名', '学生', '名字'].some((pattern) => header.includes(pattern))
  ) || ''

const resetSelection = (): void => {
  nameColumn.value = findSuggestedNameColumn()
}

const resetDialog = (): void => {
  reset()
  nameColumn.value = ''
}

const handleFileChange = async (file: UploadFile): Promise<void> => {
  if (await parseFile(file)) resetSelection()
}

const handleConfirm = (): void => {
  if (!preview.value || !fileName.value) {
    ElMessage.warning('请先选择 Excel 文件')
    return
  }
  if (!nameColumn.value) {
    ElMessage.warning('请选择姓名列')
    return
  }

  const students = buildExcelSeatingStudents(parsedData.value.data, nameColumn.value)
  if (!students.length) {
    ElMessage.warning('所选姓名列中没有可用学生')
    return
  }

  emit('confirm', { fileName: fileName.value, students })
  visible.value = false
}

watch(headerRowIndex, () => {
  if (preview.value) resetSelection()
})

watch(visible, (value) => {
  if (value) resetDialog()
})
</script>

<template>
  <el-dialog v-model="visible" title="导入座位表名单" width="900px" :close-on-click-modal="false">
    <div v-loading="loading" class="seating-student-import">
      <excel-file-dropzone
        :file-name="fileName"
        description="支持 .xlsx 和 .xls，导入后可确认表头行与姓名列"
        @change="handleFileChange"
      />

      <template v-if="preview">
        <excel-header-row-picker
          v-model="headerRowIndex"
          :rows="preview.rows"
          :merges="preview.merges"
        />

        <section class="seating-student-import__column">
          <div>
            <strong>姓名列</strong>
            <span>空姓名行会被忽略，同名学生会分别保留</span>
          </div>
          <el-select v-model="nameColumn" placeholder="选择姓名列">
            <el-option
              v-for="header in parsedData.header"
              :key="header"
              :label="header"
              :value="header"
            />
          </el-select>
        </section>
      </template>
    </div>

    <template #footer>
      <el-button @click="visible = false">取消</el-button>
      <el-button
        type="primary"
        :disabled="loading || !preview || !nameColumn"
        @click="handleConfirm"
      >
        确认导入
      </el-button>
    </template>
  </el-dialog>
</template>

<style scoped lang="scss">
.seating-student-import {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.seating-student-import__column {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 320px;
  align-items: center;
  gap: 20px;
  padding: 14px 16px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;

  div {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  strong {
    color: #1f2937;
    font-size: 14px;
  }

  span {
    color: #64748b;
    font-size: 12px;
  }
}
</style>
