<script setup lang="ts">
import { computed, ref } from 'vue'

import { ElLoading, ElMessage, ElMessageBox } from 'element-plus'

import { useDataSourceStore } from '@/stores/data-source'
import { useWorkspaceStore } from '@/stores/workspace'
import { transferWorkspaceStudent } from '@/utils/workspaceUtil'

import type { StudentDataType } from '@/types/StudentData'

const props = defineProps<{ student: StudentDataType }>()
const workspace = useWorkspaceStore()
const data = useDataSourceStore()
const visible = ref(false)
const targetId = ref('')
const targets = computed(
  () =>
    workspace.catalog?.periods.filter(
      (period) =>
        period.classId !== workspace.activePeriod?.classId &&
        period.termName === workspace.activePeriod?.termName
    ) ?? []
)

async function command(value: string): Promise<void> {
  if (value === 'transfer') {
    visible.value = true
    targetId.value = ''
    return
  }
  if (!props.student.departed) {
    try {
      await ElMessageBox.confirm(
        `${props.student.name} 本期转出后不参与后续录入和在班统计，已有成绩与往期记录保留。`,
        '本期转出',
        { confirmButtonText: '转出', cancelButtonText: '取消' }
      )
    } catch {
      return
    }
  }
  const student = data.getStudentById(props.student.studentId)
  if (!student) return
  student.departed = !student.departed
  student.departedAt = student.departed ? new Date().toISOString() : undefined
}

async function transfer(): Promise<void> {
  const loading = ElLoading.service({ lock: true, text: '正在转班…' })
  try {
    await transferWorkspaceStudent(props.student.studentId, targetId.value)
    window.location.reload()
  } catch (error) {
    console.error('学生转班失败:', error)
    ElMessage.error(error instanceof Error ? error.message : '转班失败')
  } finally {
    loading.close()
  }
}
</script>

<template>
  <el-dropdown trigger="click" @command="command">
    <el-button link :type="student.departed ? 'warning' : 'primary'"
      >{{ student.departed ? '已转出' : '在班' }} ▾</el-button
    >
    <template #dropdown
      ><el-dropdown-menu>
        <el-dropdown-item command="toggle">{{
          student.departed ? '恢复在班' : '本期转出'
        }}</el-dropdown-item>
        <el-dropdown-item v-if="!student.departed" command="transfer" :disabled="!targets.length"
          >转到其他班</el-dropdown-item
        >
      </el-dropdown-menu></template
    >
  </el-dropdown>
  <el-dialog v-model="visible" :title="`${student.name}：转到其他班`" width="460px" append-to-body>
    <p>来源成绩保留，目标班沿用学生 ID，从空白成绩和评语开始。</p>
    <el-select v-model="targetId" placeholder="选择同学期的班级" style="width: 100%"
      ><el-option
        v-for="period in targets"
        :key="period.id"
        :label="`${period.className} · ${period.termName}`"
        :value="period.id"
    /></el-select>
    <template #footer
      ><el-button @click="visible = false">取消</el-button
      ><el-button type="primary" :disabled="!targetId" @click="transfer"
        >确认转班</el-button
      ></template
    >
  </el-dialog>
</template>
