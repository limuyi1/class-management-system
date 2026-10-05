<script setup lang="ts">
import PrintStudentPicker from '@/components/student-source/PrintStudentPicker.vue'

import type { PrintStudentType } from '@/types/PrintTools'

const visible = defineModel<boolean>('visible', { required: true })
const students = defineModel<PrintStudentType[]>('students', { required: true })
defineProps<{ noticeStudents: PrintStudentType[]; preferNotice: boolean; busy: boolean }>()
</script>
<template>
  <!-- 独立宽弹窗选择名单，关闭时保留临时 Excel 与勾选状态，重新进入不重新导入。 -->
  <el-dialog
    v-model="visible"
    title="选择学生"
    width="760px"
    append-to-body
    align-center
    :close-on-click-modal="false"
    class="card-students-dialog"
  >
    <el-scrollbar max-height="65vh">
      <PrintStudentPicker
        v-model="students"
        :notice-students="noticeStudents"
        :prefer-notice="preferNotice"
        :disabled="busy"
        list-view
      />
    </el-scrollbar>
    <template #footer>
      <span class="card-students-dialog__count">已选择 {{ students.length }} 人</span>
      <el-button type="primary" @click="visible = false">完成选择</el-button>
    </template>
  </el-dialog>
</template>
<style scoped lang="scss">
.card-students-dialog__count {
  margin-right: 20px;
  color: var(--el-text-color-secondary);
  font-size: 13px;
}
</style>
