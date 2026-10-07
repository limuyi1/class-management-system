<script setup lang="ts">
import { computed, ref } from 'vue'

import { ElMessage } from 'element-plus'

import { useDataSourceStore } from '@/stores/data-source'
import { useWorkspaceStore } from '@/stores/workspace'

import type { StudentDataType } from '@/types/StudentData'

const data = useDataSourceStore()
const workspace = useWorkspaceStore()
const visible = ref(false)
const selected = ref<string[]>([])
const students = computed(() => {
  const periods = new Set(workspace.activeClassPeriods.map((period) => period.id))
  const existing = new Set(data.students.map((student) => student.studentId))
  const byId = new Map<string, StudentDataType>()
  workspace.snapshots
    .filter((snapshot) => periods.has(snapshot.id))
    .forEach((snapshot) => {
      snapshot.students.forEach((student) => {
        if (!existing.has(student.studentId)) byId.set(student.studentId, student)
      })
    })
  return [...byId.values()]
})

function open(): void {
  selected.value = []
  visible.value = true
}

function apply(): void {
  selected.value.forEach((id) => {
    const student = students.value.find((item) => item.studentId === id)
    if (student)
      data.students.push({ studentId: student.studentId, name: student.name, disabled: false })
  })
  ElMessage.success(`已加入 ${selected.value.length} 名历史学生`)
  selected.value = []
  visible.value = false
}
</script>

<template>
  <el-button size="small" @click="open">从历史名单加入</el-button>
  <el-dialog v-model="visible" title="从历史名单加入学生" width="520px" append-to-body>
    <p>保留学生 ID，当前学期成绩、评语和标签从空白开始。同名学生请核对 ID。</p>
    <el-checkbox-group v-model="selected"
      ><div v-for="student in students" :key="student.studentId">
        <el-checkbox :value="student.studentId"
          >{{ student.name }} <small>{{ student.studentId }}</small></el-checkbox
        >
      </div></el-checkbox-group
    >
    <el-empty v-if="!students.length" description="没有尚未加入本期的历史学生" />
    <template #footer
      ><el-button @click="visible = false">取消</el-button
      ><el-button type="primary" :disabled="!selected.length" @click="apply"
        >加入名单</el-button
      ></template
    >
  </el-dialog>
</template>
