<script setup lang="ts">
import { ref, watch } from 'vue'

import { useRoute, useRouter } from 'vue-router'

import LabelMaintenance from '@/views/setting/components/LabelMaintenance.vue'
import UnitConfiguration from '@/views/setting/components/UnitConfiguration.vue'
import StudentInfo from '@/views/setting/components/StudentInfo.vue'
import AIConfiguration from '@/views/setting/components/AIConfiguration.vue'
import ImportExport from '@/views/setting/components/ImportExport.vue'
import QuestionTypeMaintenance from '@/views/wrong-book/components/QuestionTypeMaintenance.vue'

const route = useRoute()
const router = useRouter()
const activeTab = ref('student-info')
const studentInfoRef = ref<InstanceType<typeof StudentInfo>>()

watch(
  () => route.query,
  (query) => {
    // 先更新 activeTab，确保与 query 参数一致
    if (
      query.tab === 'student-info' ||
      query.tab === 'label-maintenance' ||
      query.tab === 'unit-config' ||
      query.tab === 'ai-config' ||
      query.tab === 'system-backup' ||
      query.tab === 'question-type'
    ) {
      activeTab.value = query.tab
    }

    // 监听编辑标签参数，自动打开对应学生的标签编辑dialog
    if (query['edit-tags'] === '1' && query['student-name']) {
      // 延迟执行确保组件已挂载
      setTimeout(() => {
        studentInfoRef.value?.openTagEditorByName(query['student-name'] as string)
        // 清除 query 参数避免重复触发
        router.replace({ path: '/setting', query: { tab: activeTab.value } })
      }, 100)
    }
  },
  { immediate: true }
)

watch(activeTab, (newTab) => {
  router.replace({ path: '/setting', query: { tab: newTab } })
})
</script>

<template>
  <div class="setting-page">
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
          <unit-configuration />
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
          <a-i-configuration />
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
          <question-type-maintenance />
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
          <import-export />
        </div>
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<style scoped lang="scss">
.setting-page {
  height: 100%;
  padding: 8px;
  background: linear-gradient(135deg, #f5f7fa 0%, #e4e7ed 100%);
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
