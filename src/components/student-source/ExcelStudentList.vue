<script setup lang="ts">
/** 外部学生名单：支持搜索、展示安排状态并发出删除请求 */
import { computed, shallowRef } from 'vue'

import type { StudentSourceStudentType } from '@/types/StudentSource'

interface Props {
  /** 当前方案保存的外部学生名单 */
  students: StudentSourceStudentType[]
  /** 已存在座位、岗位或职务安排的学生 ID */
  assignedStudentIds: string[]
}

const props = defineProps<Props>()

const emit = defineEmits<{
  /** 请求删除指定学生 */
  remove: [student: StudentSourceStudentType]
}>()

/** 名单搜索词 */
const search = shallowRef('')
/** 已安排学生集合 */
const assignedIdSet = computed(() => new Set(props.assignedStudentIds))
/** 按姓名筛选后的学生名单 */
const filteredStudents = computed(() => {
  const keyword = search.value.trim()
  return keyword
    ? props.students.filter((student) => student.name.includes(keyword))
    : props.students
})
</script>

<template>
  <section class="excel-student-list">
    <div class="excel-student-list__toolbar">
      <el-input v-model="search" placeholder="搜索学生姓名" clearable>
        <template #prefix>
          <font-awesome-icon :icon="['solid', 'magnifying-glass']" />
        </template>
      </el-input>
      <span>共 {{ students.length }} 人</span>
    </div>

    <div v-if="filteredStudents.length" class="excel-student-list__items">
      <div v-for="student in filteredStudents" :key="student.id" class="excel-student-list__item">
        <span class="excel-student-list__avatar">{{
          student.name.trim().slice(0, 1) || '生'
        }}</span>
        <span class="excel-student-list__name">{{ student.name }}</span>
        <el-tag v-if="assignedIdSet.has(student.id)" size="small" type="success">已安排</el-tag>
        <el-button
          type="danger"
          link
          :aria-label="`从名单删除${student.name}`"
          @click="emit('remove', student)"
        >
          <font-awesome-icon :icon="['solid', 'trash-can']" />
          删除
        </el-button>
      </div>
    </div>

    <el-empty
      v-else
      :description="search.trim() ? '没有找到匹配的学生' : '当前名单为空'"
      :image-size="72"
    />
  </section>
</template>

<style scoped lang="scss">
.excel-student-list {
  display: grid;
  min-height: 0;
  gap: 10px;
}

.excel-student-list__toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
}

.excel-student-list__toolbar :deep(.el-input) {
  max-width: 280px;
}

.excel-student-list__toolbar > span {
  color: #64748b;
  font-size: 12px;
  white-space: nowrap;
}

.excel-student-list__items {
  display: grid;
  align-content: start;
  max-height: 360px;
  overflow-y: auto;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
}

.excel-student-list__item {
  display: grid;
  grid-template-columns: 32px minmax(0, 1fr) auto auto;
  align-items: center;
  gap: 10px;
  min-height: 52px;
  padding: 8px 12px;
  border-bottom: 1px solid #eef2f7;
}

.excel-student-list__item:last-child {
  border-bottom: 0;
}

.excel-student-list__avatar {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  color: #6d3fb1;
  background: #f0e9fb;
  border-radius: 50%;
  font-size: 13px;
  font-weight: 700;
}

.excel-student-list__name {
  overflow: hidden;
  color: #334155;
  font-size: 14px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
