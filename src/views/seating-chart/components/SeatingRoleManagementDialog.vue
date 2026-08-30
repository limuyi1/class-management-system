<script setup lang="ts">
/** 座位表职务管理弹窗 — 配置科目职务并批量分配学生 */
import { computed, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'

import SeatingDialogHeader from '@/views/seating-chart/components/SeatingDialogHeader.vue'

import type { SeatingRoleAssignmentType, SeatingRoleDefinitionType } from '@/types/SeatingChart'

const props = defineProps<{
  modelValue: boolean
  definitions: SeatingRoleDefinitionType[]
  assignments: SeatingRoleAssignmentType[]
  students: Array<{ id: string; name: string }>
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  save: [definitions: SeatingRoleDefinitionType[], assignments: SeatingRoleAssignmentType[]]
}>()

const visible = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit('update:modelValue', value)
})
const roleDrafts = ref<SeatingRoleDefinitionType[]>([])
const assignmentDrafts = ref<SeatingRoleAssignmentType[]>([])
const selectedRoleId = ref<string | null>(null)

/** 当前选中的职务草稿 */
const selectedRole = computed(() =>
  roleDrafts.value.find((role) => role.id === selectedRoleId.value)
)
/** 当前职务已分配的学生列表，用于多选控件双向绑定 */
const assignedStudentIds = computed<string[]>({
  get: () => {
    const roleId = selectedRoleId.value
    if (!roleId) return []
    return assignmentDrafts.value
      .filter((assignment) => assignment.roleIds.includes(roleId))
      .map((assignment) => assignment.studentId)
  },
  set: (studentIds) => {
    const roleId = selectedRoleId.value
    if (!roleId) return
    const selectedIds = new Set(studentIds)
    props.students.forEach((student) => {
      const assignment = assignmentDrafts.value.find((item) => item.studentId === student.id)
      if (selectedIds.has(student.id)) {
        if (!assignment) assignmentDrafts.value.push({ studentId: student.id, roleIds: [roleId] })
        else if (!assignment.roleIds.includes(roleId)) assignment.roleIds.push(roleId)
      } else if (assignment?.roleIds.includes(roleId)) {
        assignment.roleIds = assignment.roleIds.filter((item) => item !== roleId)
      }
    })
    assignmentDrafts.value = assignmentDrafts.value.filter(
      (assignment) => assignment.roleIds.length
    )
  }
})

/** 打开时复制 Store 数据，取消操作不会修改原座位表 */
watch(
  () => props.modelValue,
  (isVisible) => {
    if (!isVisible) return
    roleDrafts.value = props.definitions
      .map((role) => ({ ...role }))
      .sort((left, right) => left.sortOrder - right.sortOrder)
    assignmentDrafts.value = props.assignments.map((assignment) => ({
      ...assignment,
      roleIds: [...assignment.roleIds]
    }))
    selectedRoleId.value = roleDrafts.value[0]?.id || null
  },
  { immediate: true }
)

/** 组合职务全称 */
function getRoleName(role: SeatingRoleDefinitionType): string {
  return [role.subject, role.groupName, role.title].filter(Boolean).join(' · ')
}

/** 根据科目、小组和职务生成适合座位卡的简称 */
function suggestShortLabel(role: SeatingRoleDefinitionType): string {
  const subject = role.subject.trim().slice(0, 1)
  const group = role.groupName
    .trim()
    .replace(/^第/, '')
    .replace(/小?组$/, '')
    .slice(0, 2)
  const titleMap: Record<string, string> = { 组长: '组', 副组长: '副', 课代表: '课' }
  const title = titleMap[role.title.trim()] || role.title.trim().slice(0, 1)
  return `${subject}${group}${title}`.slice(0, 6) || '职务'
}

/** 新增一项职务并选中编辑 */
function addRole(): void {
  const role: SeatingRoleDefinitionType = {
    id: crypto.randomUUID(),
    subject: '语文',
    title: '组长',
    groupName: '',
    shortLabel: '语组',
    color: '#8060AA',
    sortOrder: roleDrafts.value.length
  }
  roleDrafts.value.push(role)
  selectedRoleId.value = role.id
}

/** 删除职务及草稿中的全部关联分配 */
async function removeSelectedRole(): Promise<void> {
  const role = selectedRole.value
  if (!role) return
  try {
    await ElMessageBox.confirm(
      `删除“${getRoleName(role)}”后，相关学生标注会一并清除。是否继续？`,
      '删除职务',
      { type: 'warning' }
    )
  } catch {
    return
  }
  roleDrafts.value = roleDrafts.value.filter((item) => item.id !== role.id)
  assignmentDrafts.value = assignmentDrafts.value
    .map((assignment) => ({
      ...assignment,
      roleIds: assignment.roleIds.filter((roleId) => roleId !== role.id)
    }))
    .filter((assignment) => assignment.roleIds.length)
  selectedRoleId.value = roleDrafts.value[0]?.id || null
}

/** 校验并提交全部职务设置 */
function save(): void {
  const invalidRole = roleDrafts.value.find(
    (role) => !role.subject.trim() || !role.title.trim() || !role.shortLabel.trim()
  )
  if (invalidRole) {
    selectedRoleId.value = invalidRole.id
    ElMessage.warning('请完整填写科目、职务和显示简称')
    return
  }
  const duplicate = roleDrafts.value.find((role, index) =>
    roleDrafts.value
      .slice(0, index)
      .some(
        (item) =>
          item.subject.trim() === role.subject.trim() &&
          item.title.trim() === role.title.trim() &&
          item.groupName.trim() === role.groupName.trim()
      )
  )
  if (duplicate) {
    selectedRoleId.value = duplicate.id
    ElMessage.warning('相同科目、职务和小组不能重复创建')
    return
  }
  emit(
    'save',
    roleDrafts.value.map((role, index) => ({ ...role, sortOrder: index })),
    assignmentDrafts.value
  )
  visible.value = false
}
</script>

<template>
  <el-dialog v-model="visible" width="min(920px, 94vw)" destroy-on-close align-center>
    <template #header>
      <SeatingDialogHeader
        icon="user-tag"
        title="职务管理"
        description="配置科目、正副职和小组，并为学生添加一个或多个标注"
      />
    </template>

    <div class="role-workspace">
      <aside class="role-list-panel">
        <div class="role-list-panel__heading">
          <div>
            <strong>职务列表</strong><small>共 {{ roleDrafts.length }} 项</small>
          </div>
          <el-button size="small" type="primary" plain @click="addRole">
            <font-awesome-icon :icon="['solid', 'plus']" />
            新增
          </el-button>
        </div>
        <el-scrollbar class="role-list-panel__scroll">
          <button
            v-for="role in roleDrafts"
            :key="role.id"
            type="button"
            class="role-list-item"
            :class="{ active: role.id === selectedRoleId }"
            @click="selectedRoleId = role.id"
          >
            <i :style="{ backgroundColor: role.color }"></i>
            <span
              ><strong>{{ role.shortLabel }}</strong
              ><small>{{ getRoleName(role) }}</small></span
            >
            <em
              >{{
                assignedStudentIds.length && role.id === selectedRoleId
                  ? assignedStudentIds.length
                  : assignmentDrafts.filter((item) => item.roleIds.includes(role.id)).length
              }}
              人</em
            >
          </button>
          <div v-if="!roleDrafts.length" class="role-list-empty">暂无职务，请点击“新增”</div>
        </el-scrollbar>
      </aside>

      <section v-if="selectedRole" class="role-editor">
        <div class="role-editor__heading">
          <div><strong>编辑职务</strong><small>颜色与简称会显示在座位卡和导出文件中</small></div>
          <el-button size="small" type="danger" plain @click="removeSelectedRole">
            删除职务
          </el-button>
        </div>

        <div class="role-form-grid">
          <label>
            <span>科目</span>
            <el-select
              v-model="selectedRole.subject"
              filterable
              allow-create
              default-first-option
              placeholder="选择或输入科目"
            >
              <el-option
                v-for="subject in ['语文', '数学', '英语']"
                :key="subject"
                :value="subject"
              />
            </el-select>
          </label>
          <label>
            <span>职务</span>
            <el-select
              v-model="selectedRole.title"
              filterable
              allow-create
              default-first-option
              placeholder="选择或输入职务"
            >
              <el-option
                v-for="title in ['组长', '副组长', '课代表']"
                :key="title"
                :value="title"
              />
            </el-select>
          </label>
          <label>
            <span>所属小组 <small>选填</small></span>
            <el-input v-model="selectedRole.groupName" maxlength="10" placeholder="例如：一组" />
          </label>
          <label>
            <span>显示简称</span>
            <div class="short-label-control">
              <el-input v-model="selectedRole.shortLabel" maxlength="6" placeholder="例如：语1副" />
              <el-button @click="selectedRole.shortLabel = suggestShortLabel(selectedRole)">
                自动生成
              </el-button>
            </div>
          </label>
          <label class="role-color-field">
            <span>标注颜色</span>
            <div>
              <el-color-picker v-model="selectedRole.color" />
              <code>{{ selectedRole.color }}</code>
              <span
                class="role-preview-tag"
                :style="{ color: selectedRole.color, borderColor: selectedRole.color }"
              >
                {{ selectedRole.shortLabel || '职务' }}
              </span>
            </div>
          </label>
        </div>

        <div class="role-students">
          <div class="role-students__heading">
            <div><strong>分配学生</strong><small>同一学生可以拥有多个职务</small></div>
            <span>已选择 {{ assignedStudentIds.length }} 人</span>
          </div>
          <el-select
            v-model="assignedStudentIds"
            multiple
            filterable
            collapse-tags
            collapse-tags-tooltip
            placeholder="搜索并选择学生"
          >
            <el-option
              v-for="student in students"
              :key="student.id"
              :label="student.name"
              :value="student.id"
            />
          </el-select>
        </div>
      </section>

      <section v-else class="role-editor-empty">
        <font-awesome-icon :icon="['solid', 'user-tag']" />
        <strong>还没有可编辑的职务</strong>
        <span>新增职务后，可以设置科目、正副职、小组和颜色。</span>
        <el-button type="primary" @click="addRole">新增职务</el-button>
      </section>
    </div>

    <template #footer>
      <div class="role-dialog-footer">
        <span>右键点击座位上的学生，也可以快速增减职务。</span>
        <div>
          <el-button @click="visible = false">取消</el-button>
          <el-button type="primary" @click="save">保存设置</el-button>
        </div>
      </div>
    </template>
  </el-dialog>
</template>

<style scoped lang="scss">
.role-workspace {
  display: grid;
  height: min(560px, calc(100vh - 240px));
  min-height: 440px;
  grid-template-columns: 270px minmax(0, 1fr);
  overflow: hidden;
  border: 1px solid #e5dfeb;
  border-radius: 12px;
  background: #fff;
}

.role-list-panel {
  display: flex;
  min-height: 0;
  flex-direction: column;
  padding: 12px;
  background: #faf9fd;
  border-right: 1px solid #e9e4ee;
}

.role-list-panel__heading,
.role-editor__heading,
.role-students__heading,
.role-dialog-footer,
.role-dialog-footer > div,
.role-color-field > div,
.short-label-control {
  display: flex;
  align-items: center;
}

.role-list-panel__heading,
.role-editor__heading,
.role-students__heading,
.role-dialog-footer {
  justify-content: space-between;
  gap: 12px;
}

.role-list-panel__heading div,
.role-editor__heading div,
.role-students__heading div {
  display: grid;
  gap: 2px;
}

.role-list-panel__heading strong,
.role-editor__heading strong,
.role-students__heading strong {
  color: #2d233d;
  font-size: 14px;
}

.role-list-panel__heading small,
.role-editor__heading small,
.role-students__heading small {
  color: #938a9d;
  font-size: 11px;
}

.role-list-panel__scroll {
  min-height: 0;
  margin-top: 10px;
}

.role-list-item {
  display: grid;
  width: 100%;
  grid-template-columns: 9px minmax(0, 1fr) max-content;
  align-items: center;
  gap: 9px;
  padding: 9px;
  color: #5f5669;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 8px;
  cursor: pointer;
  text-align: left;
}

.role-list-item:hover,
.role-list-item.active {
  background: #f3edfc;
  border-color: #ded1f2;
}

.role-list-item i {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.role-list-item span {
  display: grid;
  min-width: 0;
}

.role-list-item strong,
.role-list-item small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.role-list-item strong {
  color: #332a3e;
  font-size: 12px;
}

.role-list-item small,
.role-list-item em {
  color: #91889b;
  font-size: 10px;
  font-style: normal;
}

.role-list-empty {
  padding: 36px 10px;
  color: #a098a8;
  font-size: 12px;
  text-align: center;
}

.role-editor {
  min-width: 0;
  padding: 18px 20px;
  overflow-y: auto;
}

.role-form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
  margin-top: 20px;
}

.role-form-grid label {
  display: grid;
  gap: 7px;
}

.role-form-grid label > span {
  color: #51485c;
  font-size: 12px;
  font-weight: 600;
}

.role-form-grid label > span small {
  color: #9b92a4;
  font-weight: 400;
}

.short-label-control {
  gap: 7px;
}

.role-color-field {
  grid-column: 1 / -1;
}

.role-color-field > div {
  gap: 10px;
}

.role-color-field code {
  color: #84798e;
  font-size: 11px;
}

.role-preview-tag {
  padding: 2px 7px;
  background: #fff;
  border: 1px solid;
  border-radius: 999px;
  font-size: 10px;
  font-weight: 700;
}

.role-students {
  margin-top: 22px;
  padding-top: 18px;
  border-top: 1px solid #eee9f2;
}

.role-students__heading {
  margin-bottom: 10px;
}

.role-students__heading > span,
.role-dialog-footer > span {
  color: #8d8497;
  font-size: 11px;
}

.role-students :deep(.el-select) {
  width: 100%;
}

.role-editor-empty {
  display: grid;
  place-content: center;
  justify-items: center;
  gap: 8px;
  color: #948a9e;
  text-align: center;
}

.role-editor-empty svg {
  margin-bottom: 5px;
  color: #b49bd7;
  font-size: 30px;
}

.role-editor-empty strong {
  color: #4b4057;
}

.role-editor-empty span {
  margin-bottom: 7px;
  font-size: 12px;
}

.role-dialog-footer > div {
  gap: 8px;
}

@media (max-width: 760px) {
  .role-workspace {
    grid-template-columns: 220px minmax(0, 1fr);
  }

  .role-form-grid {
    grid-template-columns: 1fr;
  }

  .role-color-field {
    grid-column: auto;
  }
}
</style>
