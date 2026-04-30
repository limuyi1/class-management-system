<script setup lang="ts">
import { computed, defineAsyncComponent, ref, watch } from 'vue'

import { useRoute, useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useTabQuerySync } from '@/hooks/useTabQuerySync'
import { featureFlags } from '@/config/features'
import { useDataSourceStore } from '@/stores/data-source'

const LabelMaintenance = defineAsyncComponent(
  () => import('@/views/setting/components/LabelMaintenance.vue')
)
const UnitConfiguration = defineAsyncComponent(
  () => import('@/views/setting/components/UnitConfiguration.vue')
)
const StudentInfo = defineAsyncComponent(() => import('@/views/setting/components/StudentInfo.vue'))
const AIConfiguration = defineAsyncComponent(
  () => import('@/views/setting/components/AIConfiguration.vue')
)
const ImportExport = defineAsyncComponent(
  () => import('@/views/setting/components/ImportExport.vue')
)
const QuestionTypeMaintenance = defineAsyncComponent(
  () => import('@/views/wrong-book/components/QuestionTypeMaintenance.vue')
)

const route = useRoute()
const router = useRouter()
const dataSourceStore = useDataSourceStore()
const { items } = storeToRefs(dataSourceStore)
type SettingTabType =
  | 'student-info'
  | 'label-maintenance'
  | 'unit-config'
  | 'ai-config'
  | 'system-backup'
  | 'question-type'

const hasStudentData = computed(() => items.value.length > 0)
const validTabs = computed<SettingTabType[]>(() => {
  const tabs: SettingTabType[] = ['label-maintenance', 'unit-config', 'ai-config', 'system-backup']

  if (hasStudentData.value) {
    tabs.unshift('student-info')
  }

  if (featureFlags.questionTypeManagement) {
    tabs.push('question-type')
  }

  return tabs
})

const activeTab = ref<SettingTabType>(hasStudentData.value ? 'student-info' : 'system-backup')
const studentInfoRef = ref<InstanceType<typeof StudentInfo>>()
const pendingTagEditorStudent = ref('')
const returnTo = ref('')
const returnStudentName = ref('')

useTabQuerySync({
  route,
  router,
  activeTab,
  validTabs,
  onEditTagsContext: (query) => {
    returnTo.value = typeof query['return-to'] === 'string' ? query['return-to'] : ''
    returnStudentName.value =
      typeof query['return-student-name'] === 'string' ? query['return-student-name'] : ''
  },
  onEditTags: (studentName: string) => {
    if (!studentInfoRef.value) {
      pendingTagEditorStudent.value = studentName
      return false
    }

    studentInfoRef.value.openTagEditorByName(studentName)
    pendingTagEditorStudent.value = ''
    return true
  }
})

watch(
  () => [hasStudentData.value, route.query.tab] as const,
  async ([hasData, tab]) => {
    if (hasData || tab !== 'student-info') return
    activeTab.value = 'system-backup'
    await router.replace({ path: '/setting', query: { tab: 'system-backup' } })
  },
  { immediate: true }
)

watch(
  hasStudentData,
  (hasData) => {
    if (!hasData && activeTab.value === 'student-info') {
      activeTab.value = 'system-backup'
    }
  },
  { immediate: true }
)

watch(studentInfoRef, async (instance) => {
  if (!instance || !pendingTagEditorStudent.value) return

  instance.openTagEditorByName(pendingTagEditorStudent.value)
  pendingTagEditorStudent.value = ''
  await router.replace({ path: '/setting', query: { tab: activeTab.value } })
})
</script>

<template>
  <div class="setting-page app-page-shell">
    <el-tabs v-model="activeTab" class="setting-tabs__wrapper">
      <el-tab-pane v-if="hasStudentData" name="student-info">
        <template #label>
          <span class="custom-tabs-label">
            <font-awesome-icon :icon="['solid', 'user']" />
            <span>学生信息</span>
          </span>
        </template>
        <div class="tab-content">
          <student-info
            ref="studentInfoRef"
            :return-to="returnTo"
            :return-student-name="returnStudentName"
          />
        </div>
      </el-tab-pane>
      <el-tab-pane name="label-maintenance">
        <template #label>
          <span class="custom-tabs-label">
            <font-awesome-icon :icon="['solid', 'wrench']" />
            <span>标签维护</span>
          </span>
        </template>
        <div class="tab-content">
          <label-maintenance />
        </div>
      </el-tab-pane>
      <el-tab-pane name="unit-config">
        <template #label>
          <span class="custom-tabs-label">
            <font-awesome-icon :icon="['solid', 'screwdriver-wrench']" />
            <span>单元配置</span>
          </span>
        </template>
        <div class="tab-content">
          <el-scrollbar>
            <unit-configuration />
          </el-scrollbar>
        </div>
      </el-tab-pane>
      <el-tab-pane name="ai-config">
        <template #label>
          <span class="custom-tabs-label">
            <font-awesome-icon :icon="['solid', 'robot']" />
            <span>AI 配置</span>
          </span>
        </template>
        <div class="tab-content">
          <el-scrollbar>
            <a-i-configuration />
          </el-scrollbar>
        </div>
      </el-tab-pane>
      <el-tab-pane v-if="featureFlags.questionTypeManagement" name="question-type">
        <template #label>
          <span class="custom-tabs-label">
            <font-awesome-icon :icon="['solid', 'list-alt']" />
            <span>题型管理</span>
          </span>
        </template>
        <div class="tab-content">
          <el-scrollbar>
            <question-type-maintenance />
          </el-scrollbar>
        </div>
      </el-tab-pane>
      <el-tab-pane name="system-backup">
        <template #label>
          <span class="custom-tabs-label">
            <font-awesome-icon :icon="['solid', 'floppy-disk']" />
            <span>系统备份</span>
          </span>
        </template>
        <div class="tab-content">
          <el-scrollbar>
            <import-export />
          </el-scrollbar>
        </div>
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<style scoped lang="scss">
.setting-page {
  min-height: 0;
}

.setting-tabs__wrapper {
  height: 100%;
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.08);
  overflow: hidden;

  :deep(.el-tabs__header) {
    margin: 0;
    background: var(--theme-gradient);
    border-radius: 12px 12px 0 0;
  }

  :deep(.el-tabs__nav-wrap) {
    padding: 0 12px;
  }

  :deep(.el-tabs__item) {
    position: relative;
    height: 48px;
    line-height: 48px;
    color: rgba(255, 255, 255, 0.7);
    font-size: 14px;
    transition: all 0.3s ease;
    padding: 0 20px;

    &:hover {
      color: #fff;
    }

    &.is-active {
      color: #fff;
      font-weight: 600;
    }
  }

  :deep(.el-tabs__item.is-active .custom-tabs-label) {
    position: relative;

    &::after {
      content: '';
      display: block;
      position: absolute;
      bottom: 6px;
      left: 50%;
      transform: translateX(-50%);
      width: 38px;
      height: 3px;
      background: #fff;
      border-radius: 2px;
    }
  }

  :deep(.el-tabs__active-bar) {
    display: none;
  }

  :deep(.el-tabs__nav-scroll) {
    padding-left: 0;
  }

  :deep(.el-tabs__content) {
    height: calc(100% - 48px);
    padding: 0;
  }

  :deep(.el-tab-pane) {
    height: 100%;
  }
}

.tab-content {
  height: 100%;
  background-color: #fff;
  border-radius: 0 0 12px 12px;
}

.custom-tabs-label {
  display: flex;
  align-items: center;
  gap: 6px;

  svg {
    font-size: 14px;
  }
}
</style>
