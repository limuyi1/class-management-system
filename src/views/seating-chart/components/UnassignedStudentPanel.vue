<script setup lang="ts">
/** 未安排学生面板 — 搜索、展示未安排学生并处理拖拽/选中交互 */
import { computed, shallowRef } from 'vue'

import type { StudentSourceStudentType } from '@/types/StudentSource'

interface UnassignedStudentPanelPropsType {
  students: StudentSourceStudentType[]
  totalStudentCount: number
  selectedStudentId?: string | null
  interactionTip?: string
  completeDescription?: string
}

/** 空状态类型：搜索无结果 / 全部安排完成 / 无可安排学生 */
type EmptyStateType = 'search' | 'complete' | 'no-students'

const props = withDefaults(defineProps<UnassignedStudentPanelPropsType>(), {
  selectedStudentId: null,
  interactionTip: '拖拽或点击学生进行安排',
  completeDescription: '所有学生都已放入座位'
})

/**
 * 未安排学生面板只负责搜索、状态展示和学生交互，不直接修改座位数据。
 * 拖拽、选中和移回未安排区域都通过事件交给座位表页面处理。
 */
const emit = defineEmits<{
  dragStart: [studentId: string]
  dragEnd: []
  selectStudent: [studentId: string]
  dropToUnassigned: []
}>()

const search = shallowRef('')
/** 去掉首尾空格的搜索关键词 */
const normalizedSearch = computed(() => search.value.trim())
/** 按姓名过滤未安排学生 */
const filteredStudents = computed(() =>
  normalizedSearch.value
    ? props.students.filter((student) => student.name.includes(normalizedSearch.value))
    : props.students
)

/** 根据列表与搜索状态推导当前空状态 */
const emptyState = computed<EmptyStateType | null>(() => {
  if (filteredStudents.value.length) return null
  if (normalizedSearch.value) return 'search'
  if (props.totalStudentCount === 0) return 'no-students'
  return 'complete'
})

/** 空状态标题文案 */
const emptyTitle = computed(() => {
  if (emptyState.value === 'search') return `没有找到“${normalizedSearch.value}”`
  if (emptyState.value === 'no-students') return '暂无可安排学生'
  return '全部安排完成'
})

/** 空状态说明文案 */
const emptyDescription = computed(() => {
  if (emptyState.value === 'search') return '换个关键词，或清除当前搜索'
  if (emptyState.value === 'no-students') return '导入名单后，学生将在这里显示'
  return props.completeDescription
})

/** 空状态图标 */
const emptyIcon = computed(() => {
  if (emptyState.value === 'search') return 'magnifying-glass'
  if (emptyState.value === 'no-students') return 'user-group'
  return 'check'
})

/**
 * 获取学生姓名的首字，作为头像占位。
 * @param name - 学生姓名
 */
function getStudentInitial(name: string): string {
  return name.trim().slice(0, 1) || '生'
}
</script>

<template>
  <aside
    class="unassigned-panel"
    :class="{ 'is-complete': emptyState === 'complete' }"
    @dragover.prevent
    @drop="emit('dropToUnassigned')"
  >
    <div class="unassigned-panel__heading">
      <div>
        <strong>未安排学生</strong>
      </div>
      <span class="unassigned-panel__count" :class="{ 'is-zero': students.length === 0 }">
        <font-awesome-icon v-if="students.length === 0" :icon="['solid', 'check']" />
        {{ students.length }} 人
      </span>
    </div>

    <div v-if="$slots.source" class="unassigned-panel__source">
      <slot name="source" />
    </div>

    <template v-if="students.length || normalizedSearch">
      <el-input
        v-model="search"
        class="unassigned-panel__search"
        placeholder="搜索学生姓名"
        clearable
      >
        <template #prefix>
          <font-awesome-icon :icon="['solid', 'magnifying-glass']" />
        </template>
      </el-input>
      <p class="unassigned-panel__tip">
        <font-awesome-icon :icon="['solid', 'arrow-pointer']" />
        {{ interactionTip }}
      </p>
    </template>

    <div v-if="filteredStudents.length" class="unassigned-panel__list">
      <button
        v-for="student in filteredStudents"
        :key="student.id"
        class="student-card"
        :class="{ 'is-selected': student.id === selectedStudentId }"
        type="button"
        draggable="true"
        @dragstart="emit('dragStart', student.id)"
        @dragend="emit('dragEnd')"
        @click="emit('selectStudent', student.id)"
      >
        <span class="student-card__avatar">{{ getStudentInitial(student.name) }}</span>
        <span class="student-card__name">{{ student.name }}</span>
        <font-awesome-icon class="student-card__grip" :icon="['solid', 'grip-vertical']" />
      </button>
    </div>

    <div v-else-if="emptyState" class="unassigned-empty" :class="`is-${emptyState}`">
      <span class="unassigned-empty__icon">
        <font-awesome-icon :icon="['solid', emptyIcon]" />
      </span>
      <strong>{{ emptyTitle }}</strong>
      <p>{{ emptyDescription }}</p>
      <button v-if="emptyState === 'search'" type="button" @click="search = ''">清除搜索</button>
    </div>
  </aside>
</template>

<style scoped lang="scss">
.unassigned-panel {
  display: flex;
  flex-direction: column;
  min-height: 0;
  padding: 15px 14px;
  overflow: hidden;
  background: linear-gradient(180deg, rgba(248, 246, 252, 0.82), rgba(255, 255, 255, 0) 90px), #fff;
  border-left: 1px solid #eeeaf3;
}

.unassigned-panel__heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 12px;
}

.unassigned-panel__heading > div {
  display: grid;
  gap: 2px;
}

.unassigned-panel__heading strong {
  color: #30273b;
  font-size: 14px;
  letter-spacing: 0.01em;
}

.unassigned-panel__source {
  margin: 0 -2px 12px;
  padding-bottom: 12px;
  border-bottom: 1px solid #eeeaf3;
}

.unassigned-panel__source :deep(.student-source-selector) {
  width: 100%;
}

.unassigned-panel__source :deep(.student-source-selector__caption) {
  display: none;
}

.unassigned-panel__source :deep(.el-dropdown),
.unassigned-panel__source :deep(.student-source-selector__trigger) {
  width: 100%;
}

.unassigned-panel__count {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  min-width: 48px;
  height: 25px;
  padding: 0 8px;
  color: #6d3fb1;
  background: #f0e9fb;
  border: 1px solid #e3d6f6;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 700;
  white-space: nowrap;
}

.unassigned-panel__count.is-zero {
  color: #27815b;
  background: #eaf8f1;
  border-color: #ccebdd;
}

.unassigned-panel__search :deep(.el-input__wrapper) {
  min-height: 34px;
  background: rgba(250, 249, 252, 0.94);
  border-radius: 9px;
  box-shadow: 0 0 0 1px #e8e3ec inset;
}

.unassigned-panel__search :deep(.el-input__wrapper.is-focus) {
  box-shadow: 0 0 0 1px #9d7bc9 inset;
}

.unassigned-panel__tip {
  display: flex;
  align-items: center;
  gap: 5px;
  margin: 7px 1px 9px;
  color: #948a9e;
  font-size: 10px;
}

.unassigned-panel__tip svg {
  color: #ad9aba;
}

.unassigned-panel__list {
  display: grid;
  align-content: start;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 7px;
  min-height: 0;
  padding: 1px 3px 8px 1px;
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: #d8cfdf transparent;
}

.student-card {
  display: grid;
  grid-template-columns: 25px minmax(0, 1fr) 8px;
  align-items: center;
  gap: 6px;
  min-width: 0;
  height: 42px;
  padding: 0 7px;
  color: #443a4e;
  background: rgba(255, 255, 255, 0.92);
  border: 1px solid #e9e3ed;
  border-radius: 10px;
  cursor: grab;
  box-shadow: 0 2px 7px rgba(52, 38, 66, 0.035);
  transition:
    border-color 0.16s ease,
    background 0.16s ease,
    box-shadow 0.16s ease,
    transform 0.16s ease;
}

.student-card:hover,
.student-card.is-selected {
  background: #f8f4ff;
  border-color: #a88bd0;
  box-shadow: 0 5px 12px rgba(83, 55, 116, 0.09);
  transform: translateY(-1px);
}

.student-card:focus-visible {
  outline: 2px solid #8a65ba;
  outline-offset: 1px;
}

.student-card__avatar {
  display: grid;
  width: 25px;
  height: 25px;
  place-items: center;
  color: #76559d;
  background: #eee7f7;
  border-radius: 7px;
  font-size: 11px;
  font-weight: 750;
}

.student-card__name {
  overflow: hidden;
  font-size: 12px;
  font-weight: 620;
  text-align: left;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.student-card__grip {
  color: #b9afc0;
  font-size: 10px;
  transition: color 0.16s ease;
}

.student-card:hover .student-card__grip,
.student-card.is-selected .student-card__grip {
  color: #8061a8;
}

.unassigned-empty {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1;
  flex-direction: column;
  min-height: 150px;
  margin-top: 2px;
  padding: 24px 16px;
  overflow: hidden;
  color: #766d7f;
  background: linear-gradient(145deg, #fbfafc, #f7f4fa);
  border: 1px dashed #ddd4e3;
  border-radius: 14px;
  text-align: center;
}

.unassigned-empty::after {
  position: absolute;
  right: -24px;
  bottom: -30px;
  width: 92px;
  height: 92px;
  background: radial-gradient(circle, rgba(133, 96, 177, 0.08), transparent 68%);
  border-radius: 50%;
  content: '';
}

.unassigned-empty__icon {
  display: grid;
  width: 46px;
  height: 46px;
  margin-bottom: 12px;
  place-items: center;
  color: #8064a3;
  background: #eee8f4;
  border: 1px solid #e0d6e9;
  border-radius: 14px;
  font-size: 17px;
  box-shadow: 0 7px 16px rgba(69, 49, 89, 0.08);
}

.unassigned-empty strong {
  position: relative;
  z-index: 1;
  color: #403747;
  font-size: 14px;
}

.unassigned-empty p {
  position: relative;
  z-index: 1;
  margin: 6px 0 0;
  color: #958c9d;
  font-size: 11px;
  line-height: 1.6;
}

.unassigned-empty button {
  position: relative;
  z-index: 1;
  margin-top: 11px;
  padding: 0;
  color: #7147a8;
  background: transparent;
  border: 0;
  font-size: 12px;
  font-weight: 650;
  cursor: pointer;
}

.unassigned-empty.is-complete {
  background: linear-gradient(145deg, #f7fcf9, #f0f8f4);
  border-color: #cce5d8;
}

.unassigned-empty.is-complete::after {
  background: radial-gradient(circle, rgba(50, 145, 99, 0.1), transparent 68%);
}

.unassigned-empty.is-complete .unassigned-empty__icon {
  color: #26805a;
  background: #e3f4eb;
  border-color: #c8e7d7;
}

@media (max-width: 820px) {
  .unassigned-panel {
    min-height: 250px;
    border-top: 1px solid #eeeaf3;
    border-left: 0;
  }
}
</style>
