<script setup lang="ts">
import { computed } from 'vue'

import { useRoute, useRouter } from 'vue-router'

import PageHeader from '@/components/PageHeader.vue'

const router = useRouter()
const route = useRoute()
const templates = [
  { path: '/tools/notice-awards/notice', label: '成绩通知' },
  { path: '/tools/notice-awards/certificate', label: '奖状' },
  { path: '/tools/notice-awards/card', label: '表扬卡' },
  { path: '/tools/notice-awards/custom', label: '素材模板' }
]
const current = computed(
  () => templates.find((item) => item.path === route.path)?.label || '成绩通知'
)
</script>
<template>
  <div class="notice-award app-page-shell">
    <PageHeader
      :icon="['solid', 'file-signature']"
      title="通知与奖状"
      subtitle="选择制作类型，按步骤编辑并逐人预览"
    >
      <template #left
        ><el-button circle aria-label="返回工具" @click="router.push('/tools')"
          >←</el-button
        ></template
      >
      <template #right
        ><span class="notice-award__label">制作类型</span
        ><el-select
          :model-value="route.path"
          aria-label="制作类型"
          style="width: 140px"
          @change="router.push($event)"
          ><el-option
            v-for="item in templates"
            :key="item.path"
            :value="item.path"
            :label="item.label" /></el-select
      ></template>
    </PageHeader>
    <div class="notice-award__body" :aria-label="`${current}制作工作台`">
      <router-view :key="route.path" />
    </div>
  </div>
</template>
<style scoped lang="scss">
.notice-award {
  min-height: 0;
}
.notice-award__body {
  flex: 1;
  min-height: 0;
  min-width: 0;
  overflow: hidden;
}
.notice-award__label {
  color: var(--el-text-color-secondary);
  font-size: 12px;
  white-space: nowrap;
}
@media (max-width: 1080px) {
  .notice-award :deep(.header-text p) {
    display: none;
  }
}
</style>
