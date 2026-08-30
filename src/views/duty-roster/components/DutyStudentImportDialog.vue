<script setup lang="ts">
/** 值日表 Excel 名单导入弹窗 — 解析文件、确认表头行与姓名列并生成名单快照 */
import { shallowRef, watch } from 'vue'
import { ElMessage } from 'element-plus'

import ExcelFileDropzone from '@/components/excel/ExcelFileDropzone.vue'
import { useExcelPreviewImport } from '@/hooks/useExcelPreviewImport'
import { buildExcelDutyStudents } from '@/utils/duty-roster/dutyRosterStudentUtil'
import ExcelHeaderRowPicker from '@/views/setting/components/import/ExcelHeaderRowPicker.vue'

import type { UploadFile } from 'element-plus'
import type { ExcelStudentSourceType } from '@/types/StudentSource'

const props = defineProps<{ modelValue: boolean }>()
const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  confirm: [source: ExcelStudentSourceType]
}>()

const { fileName, headerRowIndex, loading, parsedData, preview, parseFile, reset } =
  useExcelPreviewImport({ errorLogLabel: '读取值日表 Excel' })
const nameColumn = shallowRef('')

/** 从表头中猜测姓名列，匹配常用姓名列名 */
function findSuggestedNameColumn(): string {
  return (
    parsedData.value.header.find((header) =>
      ['姓名', '学生姓名', '学生', '名字'].some((pattern) => header.includes(pattern))
    ) || ''
  )
}

/** 根据当前表头重置姓名列选择 */
function resetSelection(): void {
  nameColumn.value = findSuggestedNameColumn()
}

/**
 * 处理文件选择，解析成功后自动选中姓名列。
 * @param file - 上传的文件对象
 */
async function handleFileChange(file: UploadFile): Promise<void> {
  if (await parseFile(file)) resetSelection()
}

/** 校验并确认导入，生成 Excel 学生来源并关闭弹窗 */
function handleConfirm(): void {
  if (!preview.value || !fileName.value || !nameColumn.value) {
    ElMessage.warning('请先选择 Excel 文件和姓名列')
    return
  }
  const students = buildExcelDutyStudents(parsedData.value.data, nameColumn.value)
  if (!students.length) {
    ElMessage.warning('所选姓名列中没有可用学生')
    return
  }
  emit('confirm', { fileName: fileName.value, students })
  emit('update:modelValue', false)
}

// 表头行变化时重新猜测姓名列
watch(headerRowIndex, () => {
  if (preview.value) resetSelection()
})

// 打开弹窗时重置到初始状态
watch(
  () => props.modelValue,
  (visible) => {
    if (!visible) return
    reset()
    nameColumn.value = ''
  }
)
</script>

<template>
  <el-dialog
    :model-value="modelValue"
    title="导入值日表名单"
    width="900px"
    :close-on-click-modal="false"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div v-loading="loading" class="duty-import">
      <ExcelFileDropzone
        :file-name="fileName"
        description="支持 .xlsx 和 .xls，导入后可确认表头行与姓名列"
        @change="handleFileChange"
      />
      <template v-if="preview">
        <ExcelHeaderRowPicker
          v-model="headerRowIndex"
          :rows="preview.rows"
          :merges="preview.merges"
        />
        <section class="duty-import__column">
          <div><strong>姓名列</strong><span>空姓名会忽略，同名学生分别保留</span></div>
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
      <el-button @click="emit('update:modelValue', false)">取消</el-button>
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
.duty-import {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.duty-import__column {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 320px;
  align-items: center;
  gap: 20px;
  padding: 14px 16px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
}

.duty-import__column div {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.duty-import__column span {
  color: #64748b;
  font-size: 12px;
}
</style>
