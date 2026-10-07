<script setup lang="ts">
/** 当前方案外部学生名单管理弹窗 */
import ExcelStudentAddForm from '@/components/student-source/ExcelStudentAddForm.vue'
import ExcelStudentList from '@/components/student-source/ExcelStudentList.vue'

import type { StudentSourceStudentType } from '@/types/StudentSource'

interface Props {
  /** 当前方案外部学生名单 */
  students: StudentSourceStudentType[]
  /** 已安排学生 ID */
  assignedStudentIds: string[]
  /** 名单所属业务名称 */
  scopeLabel: string
}

const props = defineProps<Props>()
const visible = defineModel<boolean>({ required: true })

const emit = defineEmits<{
  /** 请求添加学生 */
  add: [name: string]
  /** 请求删除学生 */
  remove: [student: StudentSourceStudentType]
}>()
</script>

<template>
  <el-dialog v-model="visible" title="管理外部学生名单" width="620px" :close-on-click-modal="false">
    <div v-if="visible" class="excel-student-roster-dialog">
      <p class="excel-student-roster-dialog__description">
        此处的增删只影响{{ scopeLabel }}，不会修改系统学生或其他方案。
      </p>
      <ExcelStudentAddForm
        :existing-names="props.students.map((student) => student.name)"
        @submit="emit('add', $event)"
      />
      <ExcelStudentList
        :students="students"
        :assigned-student-ids="assignedStudentIds"
        @remove="emit('remove', $event)"
      />
    </div>

    <template #footer>
      <el-button @click="visible = false">完成</el-button>
    </template>
  </el-dialog>
</template>

<style scoped lang="scss">
.excel-student-roster-dialog {
  display: grid;
  gap: 14px;
}

.excel-student-roster-dialog__description {
  margin: 0;
  color: #64748b;
  font-size: 13px;
  line-height: 1.6;
}
</style>
