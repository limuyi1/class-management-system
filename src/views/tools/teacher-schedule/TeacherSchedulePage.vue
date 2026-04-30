<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useRoute, useRouter } from 'vue-router'

import PageHeader from '@/components/PageHeader.vue'
import { useTeacherScheduleStore } from '@/stores/teacher-schedule'
import {
  assignmentRoleOptions,
  constraintScopeOptions,
  constraintTypeOptions,
  courseCategoryOptions,
  courseStatusOptions,
  getTermLabel,
  planStatusOptions,
  semesterOptions,
  teacherStatusOptions,
  termStatusOptions
} from '@/views/tools/teacher-schedule/constants'
import type {
  TeacherScheduleAssignmentRoleType,
  TeacherScheduleConflictSeverityType,
  TeacherScheduleConstraintScopeType,
  TeacherScheduleConstraintType,
  TeacherScheduleCourseCategoryType,
  TeacherScheduleCourseStatusType,
  TeacherSchedulePlanStatusType,
  TeacherSchedulePlanType,
  TeacherScheduleSemesterType,
  TeacherScheduleTeacherStatusType,
  TeacherScheduleTermStatusType
} from '@/types/TeacherSchedule'

interface TermFormType {
  id: string
  academicYear: string
  semester: TeacherScheduleSemesterType
  name: string
  startDate: string
  endDate: string
  status: TeacherScheduleTermStatusType
  remark: string
}

interface CourseFormType {
  id: string
  name: string
  shortName: string
  category: TeacherScheduleCourseCategoryType
  isMainCourse: boolean
  allowCrossClass: boolean
  allowCrossGrade: boolean
  status: TeacherScheduleCourseStatusType
  remark: string
}

interface TemplateFormType {
  id: string
  termId: string
  grade: string
  courseId: string
  weeklyHours: number
  required: boolean
  sortOrder: number
  termScope: TeacherScheduleSemesterType
  remark: string
}

interface ClassFormType {
  id: string
  termId: string
  grade: string
  classNo: string
  name: string
  studentCount: number
  headTeacherId: string | null
  status: 'active' | 'paused' | 'archived'
  remark: string
}

interface TeacherFormType {
  id: string
  name: string
  status: TeacherScheduleTeacherStatusType
  mainSubject: string
  courseIds: string[]
  primaryCourseIds: string[]
  canBeHeadTeacher: boolean
  canTeachMainCourse: boolean
  canCrossClass: boolean
  canCrossGrade: boolean
  maxWeeklyHours: number
  specialNote: string
  remark: string
}

interface ConstraintFormType {
  id: string
  teacherId: string
  termId: string
  constraintType: TeacherScheduleConstraintType
  constraintValue: string
  scope: TeacherScheduleConstraintScopeType
  priority: number
  remark: string
}

interface HistoryFormType {
  id: string
  termId: string
  teacherId: string
  classId: string
  courseId: string | null
  role: TeacherScheduleAssignmentRoleType
  isMainCourse: boolean
  source: 'last-year' | 'last-semester' | 'manual'
  remark: string
}

const store = useTeacherScheduleStore()
const route = useRoute()
const router = useRouter()
const workflowTabStorageKey = 'teacher-schedule.workflow-tab'
const currentTermStorageKey = 'teacher-schedule.current-term'
const {
  currentTermId,
  selectedPlanId,
  terms,
  courses,
  gradeTemplates,
  classes,
  teachers,
  teacherConstraints,
  teachingHistories,
  plans,
} = storeToRefs(store)

const activeTab = ref('term')
const termDialogVisible = ref(false)
const courseDialogVisible = ref(false)
const templateDialogVisible = ref(false)
const classDialogVisible = ref(false)
const teacherDialogVisible = ref(false)
const constraintDialogVisible = ref(false)
const historyDialogVisible = ref(false)

const editingTermId = ref('')
const editingCourseId = ref('')
const editingTemplateId = ref('')
const editingClassId = ref('')
const editingTeacherId = ref('')
const editingConstraintId = ref('')
const editingHistoryId = ref('')

const createTermForm = (): TermFormType => ({
  id: '',
  academicYear: '',
  semester: 'spring',
  name: '',
  startDate: '',
  endDate: '',
  status: 'active',
  remark: ''
})

const createCourseForm = (): CourseFormType => ({
  id: '',
  name: '',
  shortName: '',
  category: 'other',
  isMainCourse: false,
  allowCrossClass: true,
  allowCrossGrade: true,
  status: 'active',
  remark: ''
})

const createTemplateForm = (): TemplateFormType => ({
  id: '',
  termId: currentTermId.value,
  grade: '',
  courseId: '',
  weeklyHours: 1,
  required: true,
  sortOrder: 0,
  termScope: 'year',
  remark: ''
})

const createClassForm = (): ClassFormType => ({
  id: '',
  termId: currentTermId.value,
  grade: '',
  classNo: '',
  name: '',
  studentCount: 0,
  headTeacherId: null,
  status: 'active',
  remark: ''
})

const createTeacherForm = (): TeacherFormType => ({
  id: '',
  name: '',
  status: 'on-duty',
  mainSubject: '',
  courseIds: [],
  primaryCourseIds: [],
  canBeHeadTeacher: true,
  canTeachMainCourse: true,
  canCrossClass: false,
  canCrossGrade: false,
  maxWeeklyHours: 24,
  specialNote: '',
  remark: ''
})

const createConstraintForm = (): ConstraintFormType => ({
  id: '',
  teacherId: '',
  termId: currentTermId.value,
  constraintType: 'cannot-main-course',
  constraintValue: '',
  scope: 'hard',
  priority: 0,
  remark: ''
})

const createHistoryForm = (): HistoryFormType => ({
  id: '',
  termId: currentTermId.value,
  teacherId: '',
  classId: '',
  courseId: null,
  role: 'course',
  isMainCourse: false,
  source: 'manual',
  remark: ''
})

const termForm = reactive<TermFormType>(createTermForm())
const courseForm = reactive<CourseFormType>(createCourseForm())
const templateForm = reactive<TemplateFormType>(createTemplateForm())
const classForm = reactive<ClassFormType>(createClassForm())
const teacherForm = reactive<TeacherFormType>(createTeacherForm())
const constraintForm = reactive<ConstraintFormType>(createConstraintForm())
const historyForm = reactive<HistoryFormType>(createHistoryForm())

const currentTerm = computed(() => store.activeTerm)
const currentPlan = computed(() => store.activePlan)
const currentClasses = computed(() => store.activeClasses)
const currentTemplates = computed(() => store.activeGradeTemplates)
const currentConstraints = computed(() => store.activeTeacherConstraints)
const currentHistories = computed(() => store.activeTeachingHistories)
const currentAssignments = computed(() => store.activeAssignments)
const currentConflicts = computed(() => store.activeConflicts)

const currentTermLabel = computed(() => currentTerm.value?.name || '未选择学期')
const currentPlanSummary = computed(() => currentPlan.value?.summary || '暂未生成排课草案')
const isStandalonePage = computed(() => route.path === '/teacher-schedule')

const workflowSteps = computed(() => {
  const hasTerm = terms.value.length > 0
  const hasClasses = currentClasses.value.length > 0
  const hasCourses = courses.value.length > 0
  const hasTemplates = currentTemplates.value.length > 0
  const hasTeachers = teachers.value.length > 0
  const hasHistories = currentHistories.value.length > 0
  const hasConstraints = currentConstraints.value.length > 0
  const hasPlan = plans.value.length > 0

  return [
    {
      key: 'term',
      title: '1. 学期',
      description: '先确定当前学年学期，所有数据都围绕它展开。',
      tab: 'term',
      done: hasTerm
    },
    {
      key: 'class',
      title: '2. 班级',
      description: '先录班级，排课的主维度就明确了。',
      tab: 'class',
      done: hasClasses
    },
    {
      key: 'course',
      title: '3. 课程',
      description: '先建课程字典，再配年级模板。',
      tab: 'course',
      done: hasCourses && hasTemplates
    },
    {
      key: 'teacher',
      title: '4. 教师',
      description: '录入教师画像和可教课程。',
      tab: 'teacher',
      done: hasTeachers
    },
    {
      key: 'history',
      title: '5. 历史与约束',
      description: '补去年与上学期任教记录，再加特殊约束。',
      tab: 'history',
      done: hasHistories || hasConstraints
    },
    {
      key: 'plan',
      title: '6. 方案',
      description: '生成草案，查看冲突，再人工微调。',
      tab: 'plan',
      done: hasPlan
    }
  ]
})

const currentWorkflowIndex = computed(() => {
  const firstPendingIndex = workflowSteps.value.findIndex((step) => !step.done)
  return firstPendingIndex === -1 ? workflowSteps.value.length - 1 : firstPendingIndex
})

const nextWorkflowStep = computed(() => {
  if (currentWorkflowIndex.value >= workflowSteps.value.length - 1) return null
  return workflowSteps.value[Math.min(currentWorkflowIndex.value + 1, workflowSteps.value.length - 1)]
})

const termOptions = computed(() =>
  terms.value.map((item) => ({
    label: item.name,
    value: item.id
  }))
)

const courseOptions = computed(() =>
  courses.value.map((item) => ({
    label: item.name,
    value: item.id
  }))
)

const teacherOptions = computed(() =>
  teachers.value.map((item) => ({
    label: item.name,
    value: item.id
  }))
)

const classOptions = computed(() =>
  currentClasses.value.map((item) => ({
    label: item.name,
    value: item.id
  }))
)

const summaryCards = computed(() => [
  {
    icon: 'calendar-days',
    label: '当前学期',
    value: currentTermLabel.value,
    hint: currentTerm.value ? getTermLabel(currentTerm.value.academicYear, currentTerm.value.semester) : ''
  },
  {
    icon: 'users',
    label: '班级',
    value: currentClasses.value.length,
    hint: '排课的主维度'
  },
  {
    icon: 'book-open',
    label: '课程',
    value: courses.value.length,
    hint: '动态维护课程字典'
  },
  {
    icon: 'person-chalkboard',
    label: '教师',
    value: teachers.value.length,
    hint: '支持在职、离职、调走'
  },
  {
    icon: 'layer-group',
    label: '草案',
    value: plans.value.length,
    hint: '支持多版本方案'
  },
  {
    icon: 'triangle-exclamation',
    label: '冲突',
    value: currentConflicts.value.length,
    hint: '生成后自动提示问题'
  }
])

const currentAssignmentsByPlan = computed(() => currentAssignments.value)

function resetTermForm(): void {
  Object.assign(termForm, createTermForm())
}

function resetCourseForm(): void {
  Object.assign(courseForm, createCourseForm())
}

function resetTemplateForm(): void {
  Object.assign(templateForm, createTemplateForm())
  templateForm.termId = currentTermId.value
}

function resetClassForm(): void {
  Object.assign(classForm, createClassForm())
  classForm.termId = currentTermId.value
}

function resetTeacherForm(): void {
  Object.assign(teacherForm, createTeacherForm())
}

function resetConstraintForm(): void {
  Object.assign(constraintForm, createConstraintForm())
  constraintForm.termId = currentTermId.value
}

function resetHistoryForm(): void {
  Object.assign(historyForm, createHistoryForm())
  historyForm.termId = currentTermId.value
}

function openAddTerm(): void {
  editingTermId.value = ''
  resetTermForm()
  termDialogVisible.value = true
}

function openEditTerm(itemId: string): void {
  const item = terms.value.find((record) => record.id === itemId)
  if (!item) return
  editingTermId.value = item.id
  Object.assign(termForm, item)
  termDialogVisible.value = true
}

function openAddCourse(): void {
  editingCourseId.value = ''
  resetCourseForm()
  courseDialogVisible.value = true
}

function openEditCourse(itemId: string): void {
  const item = courses.value.find((record) => record.id === itemId)
  if (!item) return
  editingCourseId.value = item.id
  Object.assign(courseForm, item)
  courseDialogVisible.value = true
}

function openAddTemplate(): void {
  editingTemplateId.value = ''
  resetTemplateForm()
  templateDialogVisible.value = true
}

function openEditTemplate(itemId: string): void {
  const item = gradeTemplates.value.find((record) => record.id === itemId)
  if (!item) return
  editingTemplateId.value = item.id
  Object.assign(templateForm, item)
  templateDialogVisible.value = true
}

function openAddClass(): void {
  editingClassId.value = ''
  resetClassForm()
  classDialogVisible.value = true
}

function openEditClass(itemId: string): void {
  const item = classes.value.find((record) => record.id === itemId)
  if (!item) return
  editingClassId.value = item.id
  Object.assign(classForm, item)
  classDialogVisible.value = true
}

function openAddTeacher(): void {
  editingTeacherId.value = ''
  resetTeacherForm()
  teacherDialogVisible.value = true
}

function openEditTeacher(itemId: string): void {
  const item = teachers.value.find((record) => record.id === itemId)
  if (!item) return
  editingTeacherId.value = item.id
  Object.assign(teacherForm, {
    ...item,
    courseIds: [...item.courseIds],
    primaryCourseIds: [...item.primaryCourseIds]
  })
  teacherDialogVisible.value = true
}

function openAddConstraint(): void {
  editingConstraintId.value = ''
  resetConstraintForm()
  constraintDialogVisible.value = true
}

function openEditConstraint(itemId: string): void {
  const item = teacherConstraints.value.find((record) => record.id === itemId)
  if (!item) return
  editingConstraintId.value = item.id
  Object.assign(constraintForm, item)
  constraintDialogVisible.value = true
}

function openAddHistory(): void {
  editingHistoryId.value = ''
  resetHistoryForm()
  historyDialogVisible.value = true
}

function openEditHistory(itemId: string): void {
  const item = teachingHistories.value.find((record) => record.id === itemId)
  if (!item) return
  editingHistoryId.value = item.id
  Object.assign(historyForm, item)
  historyDialogVisible.value = true
}

async function confirmDelete(message: string, title: string): Promise<boolean> {
  try {
    await ElMessageBox.confirm(message, title, {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消'
    })
    return true
  } catch {
    return false
  }
}

async function saveTerm(): Promise<void> {
  store.saveTerm({
    ...termForm,
    id: editingTermId.value || undefined
  })
  termDialogVisible.value = false
  ElMessage.success('学期已保存')
}

async function saveCourse(): Promise<void> {
  store.saveCourse({
    ...courseForm,
    id: editingCourseId.value || undefined
  })
  courseDialogVisible.value = false
  ElMessage.success('课程已保存')
}

async function saveTemplate(): Promise<void> {
  store.saveGradeTemplate({
    ...templateForm,
    id: editingTemplateId.value || undefined
  })
  templateDialogVisible.value = false
  ElMessage.success('年级模板已保存')
}

async function saveClass(): Promise<void> {
  store.saveClass({
    ...classForm,
    id: editingClassId.value || undefined
  })
  classDialogVisible.value = false
  ElMessage.success('班级已保存')
}

async function saveTeacher(): Promise<void> {
  store.saveTeacher({
    ...teacherForm,
    courseIds: [...teacherForm.courseIds],
    primaryCourseIds: [...teacherForm.primaryCourseIds],
    id: editingTeacherId.value || undefined
  })
  teacherDialogVisible.value = false
  ElMessage.success('教师已保存')
}

async function saveConstraint(): Promise<void> {
  store.saveTeacherConstraint({
    ...constraintForm,
    id: editingConstraintId.value || undefined
  })
  constraintDialogVisible.value = false
  ElMessage.success('约束已保存')
}

async function saveHistory(): Promise<void> {
  store.saveTeachingHistory({
    ...historyForm,
    id: editingHistoryId.value || undefined
  })
  historyDialogVisible.value = false
  ElMessage.success('历史记录已保存')
}

async function removeTerm(itemId: string): Promise<void> {
  const confirmed = await confirmDelete('删除学期会同步清理它下面的班级、模板、方案和记录，确定继续吗？', '删除学期')
  if (!confirmed) return
  store.removeTerm(itemId)
  ElMessage.success('学期已删除')
}

async function removeCourse(itemId: string): Promise<void> {
  const confirmed = await confirmDelete('删除课程会同步清理课程模板、历史记录和相关分配，确定继续吗？', '删除课程')
  if (!confirmed) return
  store.removeCourse(itemId)
  ElMessage.success('课程已删除')
}

async function removeTemplate(itemId: string): Promise<void> {
  const confirmed = await confirmDelete('确定删除这条年级课程模板吗？', '删除模板')
  if (!confirmed) return
  store.removeGradeTemplate(itemId)
  ElMessage.success('模板已删除')
}

async function removeClass(itemId: string): Promise<void> {
  const confirmed = await confirmDelete('删除班级会同步清理该班的历史与排课分配，确定继续吗？', '删除班级')
  if (!confirmed) return
  store.removeClass(itemId)
  ElMessage.success('班级已删除')
}

async function removeTeacher(itemId: string): Promise<void> {
  const confirmed = await confirmDelete('删除教师会同步清理约束、历史记录和分配，确定继续吗？', '删除教师')
  if (!confirmed) return
  store.removeTeacher(itemId)
  ElMessage.success('教师已删除')
}

async function removeConstraint(itemId: string): Promise<void> {
  const confirmed = await confirmDelete('确定删除这条约束吗？', '删除约束')
  if (!confirmed) return
  store.removeTeacherConstraint(itemId)
  ElMessage.success('约束已删除')
}

async function removeHistory(itemId: string): Promise<void> {
  const confirmed = await confirmDelete('确定删除这条历史记录吗？', '删除历史')
  if (!confirmed) return
  store.removeTeachingHistory(itemId)
  ElMessage.success('历史记录已删除')
}

async function generateDraftPlan(): Promise<void> {
  if (currentClasses.value.length === 0 || courses.value.length === 0 || teachers.value.length === 0) {
    ElMessage.warning('请先完成班级、课程和教师基础数据')
    return
  }

  const plan = store.generateDraftPlan()
  activeTab.value = 'plan'
  ElMessage.success(`已生成排课草案：${plan.name}`)
}

async function renamePlan(planId: string): Promise<void> {
  const plan = plans.value.find((item) => item.id === planId)
  if (!plan) return
  try {
    const result = await ElMessageBox.prompt('请输入新的方案名称', '重命名方案', {
      inputValue: plan.name,
      confirmButtonText: '保存',
      cancelButtonText: '取消'
    })
    store.savePlan({
      ...plan,
      name: result.value
    })
    ElMessage.success('方案名称已更新')
  } catch {
    // 用户取消
  }
}

async function removePlan(planId: string): Promise<void> {
  const confirmed = await confirmDelete('删除方案会同步清理其排课分配和冲突记录，确定继续吗？', '删除方案')
  if (!confirmed) return
  store.removePlan(planId)
  ElMessage.success('方案已删除')
}

function rebuildDiagnostics(planId: string): void {
  store.resetPlanDiagnostics(planId)
  const plan = plans.value.find((item) => item.id === planId)
  if (plan) {
    store.generateDraftPlan({
      name: plan.name,
      basePlanId: plan.basePlanId
    })
  }
  ElMessage.success('已重新生成草案诊断')
}

function handlePlanRowClick(row: TeacherSchedulePlanType): void {
  store.setSelectedPlan(row.id)
}

function courseLabel(courseId: string | null): string {
  if (!courseId) return '无'
  return courses.value.find((item) => item.id === courseId)?.name || courseId
}

function teacherLabel(teacherId: string): string {
  return teachers.value.find((item) => item.id === teacherId)?.name || teacherId
}

function classLabel(classId: string): string {
  return classes.value.find((item) => item.id === classId)?.name || classId
}

function planStatusLabel(status: TeacherSchedulePlanStatusType): string {
  return planStatusOptions.find((item) => item.value === status)?.label || status
}

function teacherStatusLabel(status: TeacherScheduleTeacherStatusType): string {
  return teacherStatusOptions.find((item) => item.value === status)?.label || status
}

function courseStatusLabel(status: TeacherScheduleCourseStatusType): string {
  return courseStatusOptions.find((item) => item.value === status)?.label || status
}

function termStatusLabel(status: TeacherScheduleTermStatusType): string {
  return termStatusOptions.find((item) => item.value === status)?.label || status
}

function severityTagType(severity: TeacherScheduleConflictSeverityType): 'danger' | 'warning' | 'info' {
  if (severity === 'high') return 'danger'
  if (severity === 'medium') return 'warning'
  return 'info'
}

function termScopeLabel(scope: TeacherScheduleSemesterType): string {
  return semesterOptions.find((item) => item.value === scope)?.label || scope
}

function roleLabel(role: TeacherScheduleAssignmentRoleType): string {
  return assignmentRoleOptions.find((item) => item.value === role)?.label || role
}

function constraintTypeLabel(type: TeacherScheduleConstraintType): string {
  return constraintTypeOptions.find((item) => item.value === type)?.label || type
}

function isWorkflowTab(value: string): boolean {
  return workflowSteps.value.some((item) => item.tab === value)
}

function goWorkflowTab(tab: string): void {
  activeTab.value = tab
}

function goNextWorkflowStep(): void {
  if (!nextWorkflowStep.value) return
  activeTab.value = nextWorkflowStep.value.tab
}

function backToTools(): void {
  void router.push('/tools')
}

function restoreWorkflowState(): void {
  const savedTab = window.localStorage.getItem(workflowTabStorageKey)
  if (savedTab && isWorkflowTab(savedTab)) {
    activeTab.value = savedTab
  }

  const savedTermId = window.localStorage.getItem(currentTermStorageKey)
  if (savedTermId && terms.value.some((item) => item.id === savedTermId)) {
    currentTermId.value = savedTermId
  }
}

watch(activeTab, (value) => {
  if (typeof window === 'undefined') return
  if (!isWorkflowTab(value)) return
  window.localStorage.setItem(workflowTabStorageKey, value)
})

watch(currentTermId, (value) => {
  if (typeof window === 'undefined') return
  if (!value) return
  window.localStorage.setItem(currentTermStorageKey, value)
})

onMounted(() => {
  store.ensureDefaultTerm()
  if (!selectedPlanId.value && plans.value.length > 0) {
    store.setSelectedPlan(plans.value[0].id)
  }
  restoreWorkflowState()
})
</script>

<template>
  <div
    class="teacher-schedule-page app-page-shell"
    :class="{ 'teacher-schedule-page--standalone': isStandalonePage }"
  >
    <page-header
      :icon="['solid', 'calendar-days']"
      title="教师排课"
      subtitle="先录班级、课程、教师和历史，再生成排课草案并人工微调"
    >
      <template v-if="isStandalonePage" #left>
        <el-tooltip content="返回工具" placement="top">
          <el-button size="small" circle aria-label="返回工具" @click="backToTools">
            <font-awesome-icon :icon="['solid', 'arrow-left']" />
          </el-button>
        </el-tooltip>
      </template>
    </page-header>

    <div class="teacher-schedule-page__overview">
      <el-card class="workflow-card" shadow="never">
        <template #header>
          <div class="workflow-card__header">
            <div>
              <div class="workflow-card__title">操作向导</div>
              <div class="workflow-card__subtitle">先按步骤补齐基础数据，再进入方案生成</div>
            </div>
            <el-button type="primary" plain :disabled="!nextWorkflowStep" @click="goNextWorkflowStep">
              <template #icon>
                <font-awesome-icon :icon="['solid', 'arrow-right']" />
              </template>
              {{ nextWorkflowStep ? `下一步：${nextWorkflowStep.title}` : '流程已完成' }}
            </el-button>
          </div>
        </template>

        <el-steps :active="currentWorkflowIndex" align-center finish-status="success">
          <el-step
            v-for="(step, index) in workflowSteps"
            :key="step.key"
            :title="step.title"
            :description="step.description"
            :status="step.done ? 'success' : index === currentWorkflowIndex ? 'process' : 'wait'"
            @click="goWorkflowTab(step.tab)"
          />
        </el-steps>

        <div class="workflow-card__shortcuts">
          <button
            v-for="step in workflowSteps"
            :key="step.key"
            class="workflow-card__shortcut"
            :class="{ active: activeTab === step.tab, done: step.done }"
            type="button"
            @click="goWorkflowTab(step.tab)"
          >
            <strong>{{ step.title }}</strong>
            <span>{{ step.description }}</span>
          </button>
        </div>
      </el-card>

      <div class="teacher-schedule-page__summary">
        <el-card v-for="card in summaryCards" :key="card.label" class="teacher-schedule-page__summary-card">
          <div class="teacher-schedule-page__summary-icon">
            <font-awesome-icon :icon="['solid', card.icon]" />
          </div>
          <div class="teacher-schedule-page__summary-label">{{ card.label }}</div>
          <div class="teacher-schedule-page__summary-value">{{ card.value }}</div>
          <div class="teacher-schedule-page__summary-hint">{{ card.hint }}</div>
        </el-card>
      </div>
    </div>

      <el-card class="teacher-schedule-page__workspace" shadow="never">
        <template #header>
          <div class="workspace-header">
            <div>
              <div class="workspace-header__title">第一阶段工作台</div>
              <div class="workspace-header__subtitle">先完成基础数据录入，再生成推荐方案</div>
            </div>

            <div class="workspace-header__actions">
              <el-select v-model="currentTermId" style="width: 260px" filterable>
                <el-option v-for="item in termOptions" :key="item.value" :label="item.label" :value="item.value" />
              </el-select>
              <el-button @click="openAddTerm">
                <template #icon>
                  <font-awesome-icon :icon="['solid', 'plus']" />
                </template>
                新增学期
              </el-button>
              <el-button type="primary" @click="generateDraftPlan">
                <template #icon>
                  <font-awesome-icon :icon="['solid', 'wand-magic-sparkles']" />
                </template>
                生成草案
              </el-button>
              <el-button @click="rebuildDiagnostics(selectedPlanId || currentPlan?.id || '')">
                <template #icon>
                  <font-awesome-icon :icon="['solid', 'rotate']" />
                </template>
                重算冲突
              </el-button>
            </div>
          </div>
        </template>

        <el-tabs v-model="activeTab" class="teacher-schedule-tabs">
        <el-tab-pane name="term" label="学年学期">
          <div class="tab-toolbar">
            <div class="tab-toolbar__hint">维护年度、学期和归档状态。排课方案按学期保存。</div>
            <el-button type="primary" @click="openAddTerm">
              <template #icon>
                <font-awesome-icon :icon="['solid', 'plus']" />
              </template>
              新增学期
            </el-button>
          </div>
          <el-table :data="terms" border stripe>
            <el-table-column prop="name" label="学期名称" min-width="180" />
            <el-table-column prop="academicYear" label="学年" width="140" />
            <el-table-column prop="semester" label="学期" width="120">
              <template #default="{ row }">
                {{ termScopeLabel(row.semester) }}
              </template>
            </el-table-column>
            <el-table-column prop="status" label="状态" width="100">
              <template #default="{ row }">
                <el-tag :type="row.status === 'active' ? 'success' : 'info'">
                  {{ termStatusLabel(row.status) }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="startDate" label="开始日期" width="140" />
            <el-table-column prop="endDate" label="结束日期" width="140" />
            <el-table-column prop="remark" label="备注" min-width="180" />
            <el-table-column label="操作" width="180" fixed="right">
              <template #default="{ row }">
                <el-button link type="primary" @click="openEditTerm(row.id)">编辑</el-button>
                <el-button link type="danger" @click="removeTerm(row.id)">删除</el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-tab-pane>

        <el-tab-pane name="class" label="班级">
          <div class="tab-toolbar">
            <div class="tab-toolbar__hint">先确定年级和班数，后续课程、历史和方案都围绕班级展开。</div>
            <el-button type="primary" @click="openAddClass">
              <template #icon>
                <font-awesome-icon :icon="['solid', 'plus']" />
              </template>
              新增班级
            </el-button>
          </div>
          <el-table :data="currentClasses" border stripe>
            <el-table-column prop="name" label="班级名称" min-width="160" />
            <el-table-column prop="grade" label="年级" width="100" />
            <el-table-column prop="classNo" label="班号" width="100" />
            <el-table-column prop="studentCount" label="人数" width="100" />
            <el-table-column prop="headTeacherId" label="班主任" min-width="140">
              <template #default="{ row }">
                {{ row.headTeacherId ? teacherLabel(row.headTeacherId) : '未指定' }}
              </template>
            </el-table-column>
            <el-table-column prop="status" label="状态" width="100">
              <template #default="{ row }">
                <el-tag :type="row.status === 'active' ? 'success' : 'info'">
                  {{ row.status === 'active' ? '启用' : row.status === 'paused' ? '停用' : '归档' }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="remark" label="备注" min-width="180" />
            <el-table-column label="操作" width="180" fixed="right">
              <template #default="{ row }">
                <el-button link type="primary" @click="openEditClass(row.id)">编辑</el-button>
                <el-button link type="danger" @click="removeClass(row.id)">删除</el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-tab-pane>

        <el-tab-pane name="course" label="课程">
          <div class="tab-toolbar">
            <div class="tab-toolbar__hint">课程是动态字典，后续可以继续新增，不需要改代码。</div>
            <el-button type="primary" @click="openAddCourse">
              <template #icon>
                <font-awesome-icon :icon="['solid', 'plus']" />
              </template>
              新增课程
            </el-button>
          </div>
          <el-table :data="courses" border stripe>
            <el-table-column prop="name" label="课程名称" min-width="140" />
            <el-table-column prop="shortName" label="简称" width="120" />
            <el-table-column prop="category" label="分类" width="120">
              <template #default="{ row }">
                {{ courseCategoryOptions.find((item) => item.value === row.category)?.label || row.category }}
              </template>
            </el-table-column>
            <el-table-column prop="isMainCourse" label="主课" width="100">
              <template #default="{ row }">
                <el-tag :type="row.isMainCourse ? 'danger' : 'info'">
                  {{ row.isMainCourse ? '是' : '否' }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="allowCrossClass" label="可跨班" width="100">
              <template #default="{ row }">
                <el-tag :type="row.allowCrossClass ? 'success' : 'info'">
                  {{ row.allowCrossClass ? '允许' : '限制' }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="status" label="状态" width="100">
              <template #default="{ row }">
                <el-tag :type="row.status === 'active' ? 'success' : row.status === 'paused' ? 'warning' : 'info'">
                  {{ courseStatusLabel(row.status) }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="remark" label="备注" min-width="180" />
            <el-table-column label="操作" width="180" fixed="right">
              <template #default="{ row }">
                <el-button link type="primary" @click="openEditCourse(row.id)">编辑</el-button>
                <el-button link type="danger" @click="removeCourse(row.id)">删除</el-button>
              </template>
            </el-table-column>
          </el-table>

          <el-divider />

          <div class="tab-toolbar">
            <div class="tab-toolbar__hint">年级课程模板定义“哪个年级开什么课、每周几节”。</div>
            <el-button type="primary" @click="openAddTemplate">
              <template #icon>
                <font-awesome-icon :icon="['solid', 'plus']" />
              </template>
              新增模板
            </el-button>
          </div>
          <el-table :data="currentTemplates" border stripe>
            <el-table-column prop="grade" label="年级" width="100" />
            <el-table-column prop="courseId" label="课程" min-width="140">
              <template #default="{ row }">
                {{ courseLabel(row.courseId) }}
              </template>
            </el-table-column>
            <el-table-column prop="weeklyHours" label="周课时" width="100" />
            <el-table-column prop="required" label="必开" width="100">
              <template #default="{ row }">
                <el-tag :type="row.required ? 'success' : 'info'">
                  {{ row.required ? '必开' : '选开' }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="termScope" label="学期范围" width="120">
              <template #default="{ row }">
                {{ termScopeLabel(row.termScope) }}
              </template>
            </el-table-column>
            <el-table-column prop="sortOrder" label="排序" width="80" />
            <el-table-column prop="remark" label="备注" min-width="180" />
            <el-table-column label="操作" width="180" fixed="right">
              <template #default="{ row }">
                <el-button link type="primary" @click="openEditTemplate(row.id)">编辑</el-button>
                <el-button link type="danger" @click="removeTemplate(row.id)">删除</el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-tab-pane>

        <el-tab-pane name="teacher" label="教师">
          <div class="tab-toolbar">
            <div class="tab-toolbar__hint">教师画像支持录入可教课程、主教课程和班主任候选信息。</div>
            <el-button type="primary" @click="openAddTeacher">
              <template #icon>
                <font-awesome-icon :icon="['solid', 'plus']" />
              </template>
              新增教师
            </el-button>
          </div>
          <el-table :data="teachers" border stripe>
            <el-table-column prop="name" label="姓名" min-width="120" />
            <el-table-column prop="mainSubject" label="主教学科" min-width="120" />
            <el-table-column prop="courseIds" label="可教课程" min-width="220">
              <template #default="{ row }">
                <el-tag v-for="courseId in row.courseIds" :key="courseId" size="small" class="tag-gap">
                  {{ courseLabel(courseId) }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="status" label="状态" width="100">
              <template #default="{ row }">
                <el-tag :type="row.status === 'on-duty' ? 'success' : 'info'">
                  {{ teacherStatusLabel(row.status) }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="canBeHeadTeacher" label="班主任" width="100">
              <template #default="{ row }">
                <el-tag :type="row.canBeHeadTeacher ? 'success' : 'info'">
                  {{ row.canBeHeadTeacher ? '可担任' : '不可担任' }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="canTeachMainCourse" label="主课" width="100">
              <template #default="{ row }">
                <el-tag :type="row.canTeachMainCourse ? 'success' : 'info'">
                  {{ row.canTeachMainCourse ? '可任主课' : '不任主课' }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="maxWeeklyHours" label="上限课时" width="100" />
            <el-table-column prop="specialNote" label="特殊说明" min-width="160" />
            <el-table-column label="操作" width="180" fixed="right">
              <template #default="{ row }">
                <el-button link type="primary" @click="openEditTeacher(row.id)">编辑</el-button>
                <el-button link type="danger" @click="removeTeacher(row.id)">删除</el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-tab-pane>

        <el-tab-pane name="constraint" label="约束">
          <div class="tab-toolbar">
            <div class="tab-toolbar__hint">特殊要求优先录成约束，后续生成草案时可以直接识别。</div>
            <el-button type="primary" @click="openAddConstraint">
              <template #icon>
                <font-awesome-icon :icon="['solid', 'plus']" />
              </template>
              新增约束
            </el-button>
          </div>
          <el-table :data="currentConstraints" border stripe>
            <el-table-column prop="teacherId" label="教师" min-width="120">
              <template #default="{ row }">
                {{ teacherLabel(row.teacherId) }}
              </template>
            </el-table-column>
            <el-table-column prop="constraintType" label="约束类型" min-width="160">
              <template #default="{ row }">
                {{ constraintTypeLabel(row.constraintType) }}
              </template>
            </el-table-column>
            <el-table-column prop="constraintValue" label="约束值" min-width="160" />
            <el-table-column prop="scope" label="范围" width="100">
              <template #default="{ row }">
                <el-tag :type="row.scope === 'hard' ? 'danger' : 'warning'">
                  {{ constraintScopeOptions.find((item) => item.value === row.scope)?.label || row.scope }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="priority" label="优先级" width="90" />
            <el-table-column prop="remark" label="备注" min-width="180" />
            <el-table-column label="操作" width="180" fixed="right">
              <template #default="{ row }">
                <el-button link type="primary" @click="openEditConstraint(row.id)">编辑</el-button>
                <el-button link type="danger" @click="removeConstraint(row.id)">删除</el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-tab-pane>

        <el-tab-pane name="history" label="历史">
          <div class="tab-toolbar">
            <div class="tab-toolbar__hint">历史记录用来提升“去年带过、上学期沿用”的优先级。</div>
            <el-button type="primary" @click="openAddHistory">
              <template #icon>
                <font-awesome-icon :icon="['solid', 'plus']" />
              </template>
              新增历史
            </el-button>
          </div>
          <el-table :data="currentHistories" border stripe>
            <el-table-column prop="teacherId" label="教师" min-width="120">
              <template #default="{ row }">
                {{ teacherLabel(row.teacherId) }}
              </template>
            </el-table-column>
            <el-table-column prop="classId" label="班级" min-width="120">
              <template #default="{ row }">
                {{ classLabel(row.classId) }}
              </template>
            </el-table-column>
            <el-table-column prop="courseId" label="课程" min-width="140">
              <template #default="{ row }">
                {{ courseLabel(row.courseId) }}
              </template>
            </el-table-column>
            <el-table-column prop="role" label="角色" width="100">
              <template #default="{ row }">
                {{ roleLabel(row.role) }}
              </template>
            </el-table-column>
            <el-table-column prop="isMainCourse" label="主课" width="100">
              <template #default="{ row }">
                <el-tag :type="row.isMainCourse ? 'success' : 'info'">
                  {{ row.isMainCourse ? '是' : '否' }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="source" label="来源" width="110" />
            <el-table-column prop="remark" label="备注" min-width="180" />
            <el-table-column label="操作" width="180" fixed="right">
              <template #default="{ row }">
                <el-button link type="primary" @click="openEditHistory(row.id)">编辑</el-button>
                <el-button link type="danger" @click="removeHistory(row.id)">删除</el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-tab-pane>

        <el-tab-pane name="plan" label="方案">
          <div class="plan-panel">
            <div class="plan-panel__left">
              <div class="tab-toolbar">
                <div class="tab-toolbar__hint">方案可以反复生成、复制、重命名和回退。</div>
                <el-button type="primary" @click="generateDraftPlan">
                  <template #icon>
                    <font-awesome-icon :icon="['solid', 'wand-magic-sparkles']" />
                  </template>
                  重新生成
                </el-button>
              </div>
              <el-table
                :data="plans"
                border
                stripe
                highlight-current-row
                :current-row-key="selectedPlanId"
                @row-click="handlePlanRowClick"
              >
                <el-table-column prop="name" label="方案名称" min-width="180" />
                <el-table-column prop="status" label="状态" width="100">
                  <template #default="{ row }">
                    <el-tag :type="row.status === 'draft' ? 'warning' : 'success'">
                      {{ planStatusLabel(row.status) }}
                    </el-tag>
                  </template>
                </el-table-column>
                <el-table-column prop="score" label="评分" width="90" />
                <el-table-column prop="generatedAt" label="生成时间" min-width="180" />
                <el-table-column label="操作" width="220" fixed="right">
                  <template #default="{ row }">
                    <el-button link type="primary" @click.stop="store.setSelectedPlan(row.id)">查看</el-button>
                    <el-button link type="primary" @click.stop="renamePlan(row.id)">重命名</el-button>
                    <el-button link type="danger" @click.stop="removePlan(row.id)">删除</el-button>
                  </template>
                </el-table-column>
              </el-table>
            </div>

            <div class="plan-panel__right">
              <el-card class="plan-card" shadow="never">
                <template #header>
                  <div class="plan-card__header">
                    <span>当前方案</span>
                    <el-tag type="info">{{ currentPlan?.name || '无' }}</el-tag>
                  </div>
                </template>
                <div class="plan-card__summary">{{ currentPlanSummary }}</div>
                <div class="plan-card__meta">
                  <span>评分：{{ currentPlan?.score ?? 0 }}</span>
                  <span>分配：{{ currentAssignmentsByPlan.length }}</span>
                  <span>冲突：{{ currentConflicts.length }}</span>
                </div>
              </el-card>

              <el-card class="plan-card" shadow="never">
                <template #header>
                  <div class="plan-card__header">
                    <span>分配结果</span>
                    <el-tag type="success">{{ currentAssignmentsByPlan.length }} 条</el-tag>
                  </div>
                </template>
                <el-table :data="currentAssignmentsByPlan" border stripe height="280">
                  <el-table-column prop="classId" label="班级" min-width="120">
                    <template #default="{ row }">
                      {{ classLabel(row.classId) }}
                    </template>
                  </el-table-column>
                  <el-table-column prop="role" label="角色" width="100">
                    <template #default="{ row }">
                      {{ roleLabel(row.role) }}
                    </template>
                  </el-table-column>
                  <el-table-column prop="courseId" label="课程" min-width="120">
                    <template #default="{ row }">
                      {{ courseLabel(row.courseId) }}
                    </template>
                  </el-table-column>
                  <el-table-column prop="teacherId" label="教师" min-width="120">
                    <template #default="{ row }">
                      {{ teacherLabel(row.teacherId) }}
                    </template>
                  </el-table-column>
                  <el-table-column prop="weeklyHours" label="周课时" width="90" />
                  <el-table-column prop="confidence" label="置信度" width="90" />
                </el-table>
              </el-card>

              <el-card class="plan-card" shadow="never">
                <template #header>
                  <div class="plan-card__header">
                    <span>冲突清单</span>
                    <el-tag :type="currentConflicts.length ? 'danger' : 'success'">
                      {{ currentConflicts.length }} 条
                    </el-tag>
                  </div>
                </template>
                <el-table :data="currentConflicts" border stripe height="280">
                  <el-table-column prop="severity" label="等级" width="90">
                    <template #default="{ row }">
                      <el-tag :type="severityTagType(row.severity)">{{ row.severity }}</el-tag>
                    </template>
                  </el-table-column>
                  <el-table-column prop="conflictType" label="类型" min-width="140" />
                  <el-table-column prop="message" label="说明" min-width="220" />
                  <el-table-column prop="resolved" label="状态" width="100">
                    <template #default="{ row }">
                      <el-tag :type="row.resolved ? 'success' : 'warning'">
                        {{ row.resolved ? '已解决' : '未解决' }}
                      </el-tag>
                    </template>
                  </el-table-column>
                </el-table>
              </el-card>
            </div>
          </div>
        </el-tab-pane>
      </el-tabs>
      </el-card>
    </div>

    <el-dialog v-model="termDialogVisible" :title="editingTermId ? '编辑学期' : '新增学期'" width="720px">
      <el-form :model="termForm" label-width="110px">
        <el-form-item label="学年">
          <el-input v-model="termForm.academicYear" placeholder="例如 2025-2026" />
        </el-form-item>
        <el-form-item label="学期">
          <el-select v-model="termForm.semester" style="width: 100%">
            <el-option v-for="item in semesterOptions" :key="item.value" :label="item.label" :value="item.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="名称">
          <el-input v-model="termForm.name" placeholder="留空自动生成" />
        </el-form-item>
        <el-form-item label="开始日期">
          <el-input v-model="termForm.startDate" placeholder="YYYY-MM-DD" />
        </el-form-item>
        <el-form-item label="结束日期">
          <el-input v-model="termForm.endDate" placeholder="YYYY-MM-DD" />
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="termForm.status" style="width: 100%">
            <el-option v-for="item in termStatusOptions" :key="item.value" :label="item.label" :value="item.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="termForm.remark" type="textarea" :rows="3" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="termDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveTerm">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="courseDialogVisible" :title="editingCourseId ? '编辑课程' : '新增课程'" width="720px">
      <el-form :model="courseForm" label-width="110px">
        <el-form-item label="课程名称">
          <el-input v-model="courseForm.name" placeholder="例如 语文" />
        </el-form-item>
        <el-form-item label="简称">
          <el-input v-model="courseForm.shortName" placeholder="例如 语" />
        </el-form-item>
        <el-form-item label="分类">
          <el-select v-model="courseForm.category" style="width: 100%">
            <el-option v-for="item in courseCategoryOptions" :key="item.value" :label="item.label" :value="item.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="主课">
          <el-switch v-model="courseForm.isMainCourse" />
        </el-form-item>
        <el-form-item label="可跨班">
          <el-switch v-model="courseForm.allowCrossClass" />
        </el-form-item>
        <el-form-item label="可跨年级">
          <el-switch v-model="courseForm.allowCrossGrade" />
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="courseForm.status" style="width: 100%">
            <el-option v-for="item in courseStatusOptions" :key="item.value" :label="item.label" :value="item.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="courseForm.remark" type="textarea" :rows="3" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="courseDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveCourse">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="templateDialogVisible" :title="editingTemplateId ? '编辑模板' : '新增模板'" width="720px">
      <el-form :model="templateForm" label-width="110px">
        <el-form-item label="学期">
          <el-select v-model="templateForm.termId" style="width: 100%">
            <el-option v-for="item in termOptions" :key="item.value" :label="item.label" :value="item.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="年级">
          <el-input v-model="templateForm.grade" placeholder="例如 一年级" />
        </el-form-item>
        <el-form-item label="课程">
          <el-select v-model="templateForm.courseId" style="width: 100%">
            <el-option v-for="item in courseOptions" :key="item.value" :label="item.label" :value="item.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="每周课时">
          <el-input-number v-model="templateForm.weeklyHours" :min="0" :max="20" style="width: 100%" />
        </el-form-item>
        <el-form-item label="必开">
          <el-switch v-model="templateForm.required" />
        </el-form-item>
        <el-form-item label="学期范围">
          <el-select v-model="templateForm.termScope" style="width: 100%">
            <el-option v-for="item in semesterOptions" :key="item.value" :label="item.label" :value="item.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="排序">
          <el-input-number v-model="templateForm.sortOrder" :min="0" :max="999" style="width: 100%" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="templateForm.remark" type="textarea" :rows="3" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="templateDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveTemplate">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="classDialogVisible" :title="editingClassId ? '编辑班级' : '新增班级'" width="720px">
      <el-form :model="classForm" label-width="110px">
        <el-form-item label="学期">
          <el-select v-model="classForm.termId" style="width: 100%">
            <el-option v-for="item in termOptions" :key="item.value" :label="item.label" :value="item.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="年级">
          <el-input v-model="classForm.grade" placeholder="例如 一年级" />
        </el-form-item>
        <el-form-item label="班号">
          <el-input v-model="classForm.classNo" placeholder="例如 1班" />
        </el-form-item>
        <el-form-item label="班级名称">
          <el-input v-model="classForm.name" placeholder="例如 一年级1班" />
        </el-form-item>
        <el-form-item label="学生人数">
          <el-input-number v-model="classForm.studentCount" :min="0" :max="100" style="width: 100%" />
        </el-form-item>
        <el-form-item label="班主任">
          <el-select v-model="classForm.headTeacherId" clearable style="width: 100%">
            <el-option v-for="item in teacherOptions" :key="item.value" :label="item.label" :value="item.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="classForm.status" style="width: 100%">
            <el-option label="启用" value="active" />
            <el-option label="停用" value="paused" />
            <el-option label="归档" value="archived" />
          </el-select>
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="classForm.remark" type="textarea" :rows="3" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="classDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveClass">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="teacherDialogVisible" :title="editingTeacherId ? '编辑教师' : '新增教师'" width="780px">
      <el-form :model="teacherForm" label-width="120px">
        <el-form-item label="姓名">
          <el-input v-model="teacherForm.name" placeholder="教师姓名" />
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="teacherForm.status" style="width: 100%">
            <el-option v-for="item in teacherStatusOptions" :key="item.value" :label="item.label" :value="item.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="主教学科">
          <el-input v-model="teacherForm.mainSubject" placeholder="例如 语文 / 数学 / 英语" />
        </el-form-item>
        <el-form-item label="可教课程">
          <el-select v-model="teacherForm.courseIds" multiple filterable collapse-tags style="width: 100%">
            <el-option v-for="item in courseOptions" :key="item.value" :label="item.label" :value="item.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="主教课程">
          <el-select v-model="teacherForm.primaryCourseIds" multiple filterable collapse-tags style="width: 100%">
            <el-option v-for="item in courseOptions" :key="item.value" :label="item.label" :value="item.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="班主任候选">
          <el-switch v-model="teacherForm.canBeHeadTeacher" />
        </el-form-item>
        <el-form-item label="可任主课">
          <el-switch v-model="teacherForm.canTeachMainCourse" />
        </el-form-item>
        <el-form-item label="可跨班">
          <el-switch v-model="teacherForm.canCrossClass" />
        </el-form-item>
        <el-form-item label="可跨年级">
          <el-switch v-model="teacherForm.canCrossGrade" />
        </el-form-item>
        <el-form-item label="周课时上限">
          <el-input-number v-model="teacherForm.maxWeeklyHours" :min="0" :max="80" style="width: 100%" />
        </el-form-item>
        <el-form-item label="特殊说明">
          <el-input v-model="teacherForm.specialNote" type="textarea" :rows="3" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="teacherForm.remark" type="textarea" :rows="3" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="teacherDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveTeacher">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="constraintDialogVisible" :title="editingConstraintId ? '编辑约束' : '新增约束'" width="720px">
      <el-form :model="constraintForm" label-width="120px">
        <el-form-item label="教师">
          <el-select v-model="constraintForm.teacherId" style="width: 100%">
            <el-option v-for="item in teacherOptions" :key="item.value" :label="item.label" :value="item.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="学期">
          <el-select v-model="constraintForm.termId" style="width: 100%">
            <el-option v-for="item in termOptions" :key="item.value" :label="item.label" :value="item.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="约束类型">
          <el-select v-model="constraintForm.constraintType" style="width: 100%">
            <el-option
              v-for="item in constraintTypeOptions"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="约束值">
          <el-input v-model="constraintForm.constraintValue" placeholder="可填课程、年级、班号等，用顿号/逗号分隔" />
        </el-form-item>
        <el-form-item label="约束范围">
          <el-select v-model="constraintForm.scope" style="width: 100%">
            <el-option v-for="item in constraintScopeOptions" :key="item.value" :label="item.label" :value="item.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="优先级">
          <el-input-number v-model="constraintForm.priority" :min="0" :max="100" style="width: 100%" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="constraintForm.remark" type="textarea" :rows="3" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="constraintDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveConstraint">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="historyDialogVisible" :title="editingHistoryId ? '编辑历史' : '新增历史'" width="720px">
      <el-form :model="historyForm" label-width="120px">
        <el-form-item label="学期">
          <el-select v-model="historyForm.termId" style="width: 100%">
            <el-option v-for="item in termOptions" :key="item.value" :label="item.label" :value="item.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="教师">
          <el-select v-model="historyForm.teacherId" style="width: 100%">
            <el-option v-for="item in teacherOptions" :key="item.value" :label="item.label" :value="item.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="班级">
          <el-select v-model="historyForm.classId" style="width: 100%">
            <el-option v-for="item in classOptions" :key="item.value" :label="item.label" :value="item.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="课程">
          <el-select v-model="historyForm.courseId" clearable style="width: 100%">
            <el-option v-for="item in courseOptions" :key="item.value" :label="item.label" :value="item.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="角色">
          <el-select v-model="historyForm.role" style="width: 100%">
            <el-option v-for="item in assignmentRoleOptions" :key="item.value" :label="item.label" :value="item.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="主课">
          <el-switch v-model="historyForm.isMainCourse" />
        </el-form-item>
        <el-form-item label="来源">
          <el-select v-model="historyForm.source" style="width: 100%">
            <el-option label="去年" value="last-year" />
            <el-option label="上学期" value="last-semester" />
            <el-option label="手工" value="manual" />
          </el-select>
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="historyForm.remark" type="textarea" :rows="3" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="historyDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveHistory">保存</el-button>
      </template>
    </el-dialog>
</template>

<style scoped lang="scss">
.teacher-schedule-page {
  display: flex;
  flex-direction: column;
  min-height: 0;
  gap: 16px;
}

.teacher-schedule-page--standalone {
  min-height: 100vh;
  padding: 0;
}

.teacher-schedule-page__overview {
  display: grid;
  grid-template-columns: minmax(0, 1.3fr) minmax(320px, 0.7fr);
  gap: 16px;
  align-items: start;
}

.workflow-card {
  border: 1px solid color-mix(in srgb, var(--theme-menu-active) 12%, #e5e7eb);
  border-radius: 18px;
  box-shadow: 0 18px 40px rgba(15, 23, 42, 0.06);
  background:
    radial-gradient(circle at top right, color-mix(in srgb, var(--theme-menu-active) 10%, #ffffff), transparent 34%),
    #ffffff;
}

.workflow-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.workflow-card__title {
  color: #111827;
  font-size: 16px;
  font-weight: 700;
}

.workflow-card__subtitle {
  margin-top: 4px;
  color: #6b7280;
  font-size: 13px;
}

.workflow-card__shortcuts {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
  gap: 10px;
  margin-top: 16px;
}

.workflow-card__shortcut {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 12px 14px;
  text-align: left;
  color: #1f2937;
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 14px;
  cursor: pointer;
  transition:
    border-color 0.2s,
    box-shadow 0.2s,
    transform 0.2s;
}

.workflow-card__shortcut:hover {
  border-color: color-mix(in srgb, var(--theme-menu-active) 30%, #e5e7eb);
  box-shadow: 0 10px 20px rgba(15, 23, 42, 0.08);
  transform: translateY(-1px);
}

.workflow-card__shortcut strong {
  font-size: 14px;
  font-weight: 600;
}

.workflow-card__shortcut span {
  color: #6b7280;
  font-size: 12px;
  line-height: 1.5;
}

.workflow-card__shortcut.active {
  border-color: var(--theme-menu-active);
  background: linear-gradient(180deg, color-mix(in srgb, var(--theme-menu-active) 9%, #ffffff) 0%, #ffffff 100%);
  box-shadow: 0 12px 24px rgba(37, 99, 235, 0.08);
}

.workflow-card__shortcut.done {
  border-color: color-mix(in srgb, #22c55e 24%, #d1fae5);
}

.teacher-schedule-page__summary {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.teacher-schedule-page__summary-card {
  padding: 16px 16px 14px;
  border: 1px solid color-mix(in srgb, var(--theme-menu-active) 14%, #e5e7eb);
  border-radius: 18px;
  box-shadow: 0 14px 32px rgba(15, 23, 42, 0.05);
  background: linear-gradient(180deg, #ffffff 0%, color-mix(in srgb, var(--theme-menu-active) 4%, #ffffff) 100%);
  overflow: hidden;
}

.teacher-schedule-page__summary-card::before {
  content: '';
  display: block;
  width: 100%;
  height: 3px;
  margin-bottom: 12px;
  border-radius: 999px;
  background: linear-gradient(90deg, var(--theme-menu-active), color-mix(in srgb, var(--theme-menu-active) 18%, #ffffff));
}

.teacher-schedule-page__summary-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  color: var(--theme-menu-active);
  background: var(--theme-menu-active-bg);
  border-radius: 12px;
  font-size: 15px;
}

.teacher-schedule-page__summary-label {
  margin-top: 10px;
  color: #6b7280;
  font-size: 13px;
}

.teacher-schedule-page__summary-value {
  margin-top: 6px;
  color: #111827;
  font-size: 24px;
  font-weight: 700;
}

.teacher-schedule-page__summary-hint {
  margin-top: 4px;
  color: #94a3b8;
  font-size: 12px;
}

.teacher-schedule-page__workspace {
  min-height: 0;
  margin-top: 0;
  border: 1px solid #e5e7eb;
  border-radius: 18px;
  box-shadow: 0 18px 40px rgba(15, 23, 42, 0.06);
}

.workspace-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.workspace-header__title {
  color: #111827;
  font-size: 17px;
  font-weight: 700;
}

.workspace-header__subtitle {
  margin-top: 4px;
  color: #6b7280;
  font-size: 13px;
}

.workspace-header__actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

.teacher-schedule-tabs {
  min-height: 0;
}

:deep(.teacher-schedule-tabs .el-tabs__header) {
  margin: 0 0 14px;
}

:deep(.teacher-schedule-tabs .el-tabs__nav-wrap::after) {
  display: none;
}

:deep(.teacher-schedule-tabs .el-tabs__item) {
  margin-right: 6px;
  padding: 0 16px;
  border-radius: 999px;
  color: #64748b;
  background: #f8fafc;
  transition:
    background 0.2s,
    color 0.2s,
    box-shadow 0.2s;
}

:deep(.teacher-schedule-tabs .el-tabs__item.is-active) {
  color: var(--theme-menu-active);
  background: var(--theme-menu-active-bg);
  box-shadow: 0 10px 22px rgba(37, 99, 235, 0.08);
}

.tab-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.tab-toolbar__hint {
  color: #6b7280;
  font-size: 13px;
}

.tag-gap {
  margin-right: 6px;
  margin-bottom: 4px;
}

.plan-panel {
  display: grid;
  grid-template-columns: minmax(360px, 1.05fr) minmax(340px, 0.95fr);
  gap: 16px;
}

.plan-panel__left,
.plan-panel__right {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
}

.plan-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  font-weight: 600;
}

.plan-card {
  border-radius: 16px;
  border: 1px solid #e5e7eb;
  box-shadow: 0 12px 28px rgba(15, 23, 42, 0.05);
}

.plan-card__summary {
  color: #374151;
  line-height: 1.7;
}

.plan-card__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 12px;
  color: #6b7280;
  font-size: 13px;
}

:deep(.el-tabs__content) {
  overflow: visible;
}

:deep(.el-table) {
  width: 100%;
}

:deep(.teacher-schedule-page .el-table) {
  border-radius: 14px;
  overflow: hidden;
}

:deep(.teacher-schedule-page .el-table thead th) {
  background: #f8fafc;
  color: #475569;
  font-weight: 600;
}

:deep(.teacher-schedule-page .el-table tbody td) {
  border-color: #eef2f7;
}

@media (max-width: 1280px) {
  .teacher-schedule-page__overview {
    grid-template-columns: 1fr;
  }

  .teacher-schedule-page__summary {
    grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
  }

  .plan-panel {
    grid-template-columns: 1fr;
  }
}
</style>
