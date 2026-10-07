<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import { ElMessage } from 'element-plus'

import ExcelFileDropzone from '@/components/excel/ExcelFileDropzone.vue'
import ExcelHeaderRowPicker from '@/views/setting/components/import/ExcelHeaderRowPicker.vue'
import { useExcelPreviewImport } from '@/hooks/useExcelPreviewImport'
import { useDataSourceStore } from '@/stores/data-source'
import { useWorkspaceStore } from '@/stores/workspace'

import type { PrintStudentType } from '@/types/PrintTools'

const props = withDefaults(
  defineProps<{
    listView?: boolean
    systemOnly?: boolean
    disabled?: boolean
    noticeStudents?: PrintStudentType[]
    preferNotice?: boolean
  }>(),
  {
    listView: false,
    systemOnly: false,
    disabled: false
  }
)
const selected = defineModel<PrintStudentType[]>({ required: true })
const data = useDataSourceStore()
const workspace = useWorkspaceStore()
const source = ref(props.preferNotice && props.noticeStudents?.length ? 'notice' : 'system')
/** 素材通知使用逐人的成绩与评语，避免把示例内容作为全班数据。 */
watch(
  () => props.preferNotice,
  (prefer) => {
    if (prefer && props.noticeStudents?.length) source.value = 'notice'
  }
)
const external = ref<PrintStudentType[]>([])
const selectedIds = ref<string[]>([])
const importVisible = ref(false)
const nameColumn = ref('')
const sorted = ref(false)
const { fileName, headerRowIndex, loading, parsedData, preview, parseFile, reset } =
  useExcelPreviewImport()
const students = computed<PrintStudentType[]>(() => {
  const rows =
    source.value === 'notice'
      ? props.noticeStudents || []
      : source.value === 'system'
        ? data.enabledData.map((student) => ({
            id: student.studentId,
            name: String(student.name || ''),
            fields: {
              姓名: String(student.name || ''),
              班级: workspace.activePeriod?.className || '',
              学期: workspace.activePeriod?.termName || ''
            }
          }))
        : external.value
  return sorted.value ? [...rows].sort((a, b) => a.name.localeCompare(b.name, 'zh-CN')) : rows
})
watch(
  students,
  (rows, old) => {
    const previous = new Set(old?.map((student) => student.id))
    selectedIds.value = rows
      .filter((student) => !previous.has(student.id) || selectedIds.value.includes(student.id))
      .map((student) => student.id)
  },
  { immediate: true }
)
watch(
  [students, selectedIds],
  () => {
    selected.value = students.value.filter((student) => selectedIds.value.includes(student.id))
  },
  { immediate: true }
)
watch(
  () => parsedData.value.header,
  (headers) => {
    nameColumn.value = headers.find((header) => /姓名|名字/.test(header)) || headers[0] || ''
  }
)

/** 打开新一轮临时名单导入，清空上次的解析结果。 */
function openImport(): void {
  reset()
  importVisible.value = true
}

/** 保留 Excel 每一行的身份和自定义字段，不合并同名学生。 */
function confirmImport(): void {
  const rows = parsedData.value.data.flatMap((row): PrintStudentType[] => {
    const name = String(row[nameColumn.value] ?? '').trim()
    if (!name) return []
    return [
      {
        id: crypto.randomUUID(),
        name,
        fields: {
          ...Object.fromEntries(
            Object.entries(row).map(([key, value]) => [key, String(value ?? '')])
          ),
          姓名: name
        }
      }
    ]
  })
  if (!rows.length) {
    ElMessage.warning('所选姓名列没有有效学生')
    return
  }
  external.value = rows
  source.value = 'excel'
  importVisible.value = false
}
</script>

<template>
  <section
    class="print-students"
    :class="{ 'print-students--list': listView }"
    :inert="props.disabled || undefined"
  >
    <div class="print-students__toolbar">
      <el-radio-group v-if="!systemOnly" v-model="source" size="small">
        <el-radio-button value="system">当前班级</el-radio-button>
        <el-radio-button value="excel">Excel 名单</el-radio-button>
        <el-radio-button v-if="noticeStudents?.length" value="notice">通知名单</el-radio-button>
      </el-radio-group>
      <el-button v-if="!systemOnly" size="small" @click="openImport">导入 Excel</el-button>
      <el-checkbox v-model="sorted">按姓名排序</el-checkbox>
      <el-button size="small" @click="selectedIds = students.map((student) => student.id)"
        >全选</el-button
      >
      <el-button size="small" @click="selectedIds = []">清空选择</el-button>
      <span>已选 {{ selected.length }} / {{ students.length }} 人</span>
    </div>
    <!-- 宽弹窗直接勾选姓名，名单较长时由 Element Plus 滚动容器承载。 -->
    <el-scrollbar v-if="listView && students.length" max-height="340px">
      <el-checkbox-group v-model="selectedIds" :disabled="disabled" class="print-students__grid">
        <el-checkbox
          v-for="(student, index) in students"
          :key="student.id"
          :value="student.id"
          :title="student.name"
        >
          {{ index + 1 }}. {{ student.name }}
        </el-checkbox>
      </el-checkbox-group>
    </el-scrollbar>
    <el-empty v-else-if="listView" :image-size="64" description="暂无学生，可导入 Excel 名单" />
    <el-select
      v-else
      v-model="selectedIds"
      multiple
      filterable
      collapse-tags
      collapse-tags-tooltip
      :max-collapse-tags="2"
      placeholder="选择学生"
      style="width: 100%"
    >
      <el-option
        v-for="(student, index) in students"
        :key="student.id"
        :value="student.id"
        :label="`${index + 1}. ${student.name}`"
      />
    </el-select>
    <el-dialog v-model="importVisible" title="导入打印名单" width="900px" append-to-body>
      <div v-loading="loading">
        <ExcelFileDropzone
          :file-name="fileName"
          description="选择姓名列；其他列可在奖状中作为变量使用"
          @change="parseFile"
        />
        <ExcelHeaderRowPicker
          v-if="preview"
          v-model="headerRowIndex"
          :rows="preview.rows"
          :merges="preview.merges"
        />
        <el-select
          v-if="preview"
          v-model="nameColumn"
          placeholder="姓名列"
          style="width: 100%; margin-top: 16px"
        >
          <el-option
            v-for="header in parsedData.header"
            :key="header"
            :label="header"
            :value="header"
          />
        </el-select>
      </div>
      <template #footer
        ><el-button @click="importVisible = false">取消</el-button
        ><el-button type="primary" :disabled="loading || !nameColumn" @click="confirmImport"
          >使用名单</el-button
        ></template
      >
    </el-dialog>
  </section>
</template>

<style scoped lang="scss">
.print-students {
  display: grid;
  gap: 12px;
}
.print-students__toolbar {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  color: var(--el-text-color-secondary);
  font-size: 13px;
}
.print-students__grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px 16px;
  padding: 12px;
  border: 1px solid var(--el-border-color-light);
  border-radius: 8px;
}
.print-students__grid :deep(.el-checkbox) {
  margin-right: 0;
  min-width: 0;
}
.print-students__grid :deep(.el-checkbox__label) {
  overflow: hidden;
  text-overflow: ellipsis;
}
.print-students--list .print-students__toolbar {
  gap: 12px;
  margin-bottom: 4px;
}
</style>
