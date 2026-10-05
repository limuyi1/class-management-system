<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'

import { ElLoading, ElMessage, ElMessageBox } from 'element-plus'

import { liveQuery } from 'dexie'

import { db, DB_ID } from '@/db'
import { useWorkspaceStore } from '@/stores/workspace'
import { getWorkspaceRevision } from '@/utils/workspaceSessionUtil'
import { isDatabaseImporting } from '@/utils/persistDexieImportState'
import {
  createWorkspace,
  inheritWorkspaceSchedules,
  deleteWorkspacePeriod,
  renameWorkspace,
  switchWorkspace
} from '@/utils/workspaceUtil'

import type { WorkspacePeriodType } from '@/types/Workspace'

const workspace = useWorkspaceStore()
const managerVisible = ref(false)
const formVisible = ref(false)
const busy = ref(false)
const editingId = ref('')
const scheduleVisible = ref(false)
const scheduleSource = ref('')
const scheduleSources = computed(() =>
  workspace.activeClassPeriods.filter((period) => period.id !== current.value?.id)
)
const form = ref({
  className: '',
  termName: '',
  newClass: false,
  inheritStudents: true,
  inheritColumns: true,
  useReference: true
})

const classes = computed(
  () =>
    workspace.catalog?.classes.map((item) => ({
      ...item,
      period: workspace.catalog?.periods.find((period) => period.id === item.lastPeriodId)
    })) ?? []
)
const periods = computed(() => [...workspace.activeClassPeriods].reverse())
const current = computed(() => workspace.activePeriod)

/** 加载期间锁定操作；切换成功刷新页面，完整销毁旧班级临时状态。 */
async function run(
  action: () => Promise<unknown>,
  reload = false,
  destination?: string
): Promise<boolean> {
  if (busy.value) return false
  busy.value = true
  const loading = ElLoading.service({ lock: true, text: '正在保存并加载班级数据…' })
  try {
    await action()
    if (reload) {
      window.location.hash = destination ?? window.location.hash.split('?')[0]
      window.location.reload()
      return true
    }
    await workspace.refresh()
    return true
  } catch (error) {
    console.error('班级学期操作失败:', error)
    ElMessage.error(error instanceof Error ? error.message : '操作失败，原数据已保留')
    return false
  } finally {
    loading.close()
    busy.value = false
  }
}

async function selectPeriod(id: string): Promise<void> {
  if (id === current.value?.id) return
  await run(() => switchWorkspace(id), true)
}

async function selectClass(id: string): Promise<void> {
  const target = workspace.catalog?.classes.find((item) => item.id === id)
  if (target) await selectPeriod(target.lastPeriodId)
}

function openCreate(newClass: boolean): void {
  editingId.value = ''
  form.value = {
    className: newClass ? '' : (current.value?.className ?? ''),
    termName: newClass ? (current.value?.termName ?? '') : '',
    newClass,
    inheritStudents: true,
    inheritColumns: true,
    useReference: true
  }
  formVisible.value = true
}

function openRename(period: WorkspacePeriodType): void {
  editingId.value = period.id
  form.value.className = period.className
  form.value.termName = period.termName
  formVisible.value = true
}

async function submit(): Promise<void> {
  if (editingId.value) {
    const succeeded = await run(() =>
      renameWorkspace(editingId.value, form.value.className, form.value.termName)
    )
    if (succeeded) formVisible.value = false
  } else {
    await run(() => createWorkspace(form.value), true, '#/student-info')
  }
}

async function remove(period: WorkspacePeriodType): Promise<void> {
  const snapshot = workspace.snapshots.find((item) => item.id === period.id)
  try {
    await ElMessageBox.confirm(
      `将永久删除 ${period.className} · ${period.termName} 的名单、成绩、评语、通知单与排表数据（${snapshot?.students.length ?? 0} 名学生）。此操作无法撤销。`,
      '删除学期',
      { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' }
    )
  } catch {
    return
  }
  await run(() => deleteWorkspacePeriod(period.id))
}

async function inheritSchedules(): Promise<void> {
  try {
    await ElMessageBox.confirm(
      '来源中存在的座位表、值日表会替换本期对应安排。系统名单按本期校对，独立 Excel 名单保留。是否继续？',
      '沿用往期排表',
      { type: 'warning', confirmButtonText: '沿用', cancelButtonText: '取消' }
    )
  } catch {
    return
  }
  await run(() => inheritWorkspaceSchedules(scheduleSource.value), true)
}

let unsubscribe: (() => void) | undefined
onMounted(() => {
  const subscription = liveQuery(() => db.workspaces.get(DB_ID)).subscribe({
    next: (catalog) => {
      if (!catalog || isDatabaseImporting()) return
      if (getWorkspaceRevision() && catalog.revision !== getWorkspaceRevision()) {
        // 多标签页共享同一个当前工作区。旧页面的写入已由持久化版本校验阻止。
        window.location.reload()
      } else {
        workspace.catalog = catalog
      }
    },
    error: (error) => console.error('班级目录同步失败:', error)
  })
  unsubscribe = () => subscription.unsubscribe()
})
onUnmounted(() => unsubscribe?.())
</script>

<template>
  <div class="workspace-selector">
    <el-select
      :model-value="current?.classId"
      aria-label="班级"
      class="workspace-selector__class"
      :disabled="busy"
      @change="selectClass"
    >
      <el-option
        v-for="item in classes"
        :key="item.id"
        :value="item.id"
        :label="item.id === current?.classId ? current.className : item.period?.className || '班级'"
      />
    </el-select>
    <el-select
      :model-value="current?.id"
      aria-label="学期"
      class="workspace-selector__period"
      :disabled="busy"
      @change="selectPeriod"
    >
      <el-option
        v-for="period in periods"
        :key="period.id"
        :value="period.id"
        :label="`${period.termName} · ${period.className}`"
      />
    </el-select>
    <el-button @click="managerVisible = true">管理</el-button>

    <el-dialog v-model="managerVisible" title="班级与学期管理" width="760px" append-to-body>
      <div class="workspace-selector__actions">
        <el-button type="primary" @click="openCreate(false)">进入新学期 / 升班</el-button>
        <el-button @click="openCreate(true)">创建另一个班级</el-button>
        <el-button :disabled="!scheduleSources.length" @click="scheduleVisible = true"
          >沿用往期排表</el-button
        >
      </div>
      <p>
        当前：{{ current?.className }} ·
        {{ current?.termName }}。旧学期可以随时打开，修改当期班名不会影响往期。
      </p>
      <el-table :data="workspace.catalog?.periods || []" max-height="400">
        <el-table-column prop="className" label="当期班名" width="120" />
        <el-table-column prop="termName" label="学期" min-width="170" />
        <el-table-column label="操作" width="210">
          <template #default="{ row }">
            <el-button
              link
              type="primary"
              :disabled="row.id === current?.id"
              @click="selectPeriod(row.id)"
              >{{ row.id === current?.id ? '当前' : '打开' }}</el-button
            >
            <el-button link @click="openRename(row)">修改名称</el-button>
            <el-button link type="danger" :disabled="row.id === current?.id" @click="remove(row)"
              >删除</el-button
            >
          </template>
        </el-table-column>
      </el-table>
      <p class="workspace-selector__hint">
        切换会重新加载页面。已保存数据自动保留；请先保存正在编辑的表单或预览内容。
      </p>
    </el-dialog>

    <el-dialog
      v-model="formVisible"
      :title="editingId ? '修改当期名称' : form.newClass ? '创建另一个班级' : '进入新学期 / 升班'"
      width="500px"
      append-to-body
      :close-on-click-modal="false"
    >
      <el-form label-width="100px">
        <el-form-item label="当期班名"
          ><el-input v-model="form.className" maxlength="50" placeholder="例如：403 班"
        /></el-form-item>
        <el-form-item label="学期"
          ><el-input v-model="form.termName" maxlength="80" placeholder="例如：2026–2027 上学期"
        /></el-form-item>
        <template v-if="!editingId && !form.newClass">
          <p>来源：{{ current?.className }} · {{ current?.termName }}</p>
          <el-checkbox v-model="form.inheritStudents">沿用在班学生名单（保留学生 ID）</el-checkbox
          ><br />
          <el-checkbox v-model="form.inheritColumns">沿用单元配置，成绩留空</el-checkbox><br />
          <el-checkbox v-model="form.useReference">使用上期最后一次成绩作为趋势参照</el-checkbox>
          <p class="workspace-selector__hint">
            新学期评语和表现标签从空白开始，旧期数据完整保留。创建后可在学生信息页调整转入、转出。
          </p>
        </template>
        <p v-else-if="!editingId">新班级从空名单开始，创建后可导入学生。</p>
      </el-form>
      <template #footer
        ><el-button @click="formVisible = false">取消</el-button
        ><el-button
          type="primary"
          :loading="busy"
          :disabled="!form.className.trim() || !form.termName.trim()"
          @click="submit"
          >{{ editingId ? '保存' : '创建并进入' }}</el-button
        ></template
      >
    </el-dialog>

    <el-dialog
      v-model="scheduleVisible"
      title="沿用往期座位表、值日表"
      width="480px"
      append-to-body
    >
      <el-select v-model="scheduleSource" placeholder="选择来源学期" style="width: 100%"
        ><el-option
          v-for="period in scheduleSources"
          :key="period.id"
          :label="`${period.termName} · ${period.className}`"
          :value="period.id"
      /></el-select>
      <template #footer
        ><el-button @click="scheduleVisible = false">取消</el-button
        ><el-button
          type="primary"
          :loading="busy"
          :disabled="!scheduleSource"
          @click="inheritSchedules"
          >沿用</el-button
        ></template
      >
    </el-dialog>
  </div>
</template>

<style scoped lang="scss">
.workspace-selector {
  display: flex;
  align-items: center;
  gap: 8px;
  &__class {
    width: 130px;
  }
  &__period {
    width: 250px;
  }
  &__actions {
    display: flex;
    gap: 8px;
    margin: 16px 0;
    flex-wrap: wrap;
  }
  &__hint {
    color: var(--el-text-color-secondary);
    font-size: 13px;
    line-height: 1.7;
  }
}
</style>
