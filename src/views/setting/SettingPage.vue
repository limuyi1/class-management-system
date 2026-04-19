<script setup lang="ts">
import { ref, defineAsyncComponent } from 'vue'

import { useRoute, useRouter } from 'vue-router'
import { useTabQuerySync } from '@/hooks/useTabQuerySync'

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
const validTabs = [
  'student-info',
  'label-maintenance',
  'unit-config',
  'ai-config',
  'system-backup',
  'question-type'
] as const
type SettingTabType = (typeof validTabs)[number]

const activeTab = ref<SettingTabType>('student-info')
const studentInfoRef = ref<InstanceType<typeof StudentInfo>>()

useTabQuerySync({
  route,
  router,
  activeTab,
  validTabs,
  onEditTags: (studentName: string) => {
    studentInfoRef.value?.openTagEditorByName(studentName)
  }
})
</script>

<template>
  <div class="setting-page app-page-shell">
    <el-tabs v-model="activeTab" class="setting-tabs__wrapper">
      <el-tab-pane name="student-info">
        <template #label>
          <span class="custom-tabs-label">
            <font-awesome-icon :icon="['solid', 'user']" />
            <span>学生信息</span>
          </span>
        </template>
        <div class="tab-content">
          <student-info ref="studentInfoRef" />
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
      <el-tab-pane name="question-type">
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
