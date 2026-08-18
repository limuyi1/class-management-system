<script setup lang="ts">
/** 学生信息页 — 学生列表展示、筛选和标签编辑 */
import { computed, nextTick, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'

import { useDataSourceStore } from '@/stores/data-source'
import StudentInfo from '@/views/setting/components/StudentInfo.vue'

const route = useRoute()
const router = useRouter()
const dataSourceStore = useDataSourceStore()
const { enabledData } = storeToRefs(dataSourceStore)

const hasStudentData = computed(() => enabledData.value.length > 0)
const studentInfoRef = ref<InstanceType<typeof StudentInfo>>()
const pendingTagEditorStudentId = ref('')
const returnTo = ref('')
const returnStudentId = ref('')

const clearEditTagsQuery = async () => {
  await router.replace({ path: '/student-info' })
}

const syncEditTagsQuery = async () => {
  if (route.query['edit-tags'] !== '1') return

  const studentId = route.query['student-id']
  if (typeof studentId !== 'string' || !studentId) return

  returnTo.value = typeof route.query['return-to'] === 'string' ? route.query['return-to'] : ''
  returnStudentId.value =
    typeof route.query['return-student-id'] === 'string' ? route.query['return-student-id'] : ''

  await nextTick()

  if (!studentInfoRef.value) {
    pendingTagEditorStudentId.value = studentId
    return
  }

  studentInfoRef.value.openTagEditorById(studentId)
  pendingTagEditorStudentId.value = ''
  await clearEditTagsQuery()
}

watch(
  hasStudentData,
  async (hasData) => {
    // 无学生数据时跳回工具页
    if (hasData) return
    await router.replace('/tools')
  },
  { immediate: true }
)

// 路由查询参数变化时触发标签编辑
watch(
  () => route.query,
  () => {
    syncEditTagsQuery()
  },
  { immediate: true }
)

// 组件实例就绪后，补开此前暂存的标签编辑器
watch(studentInfoRef, async (instance) => {
  if (!instance || !pendingTagEditorStudentId.value) return

  instance.openTagEditorById(pendingTagEditorStudentId.value)
  pendingTagEditorStudentId.value = ''
  await clearEditTagsQuery()
})
</script>

<template>
  <div class="student-info-page app-page-shell">
    <div class="student-info-page__panel">
      <student-info
        ref="studentInfoRef"
        :return-to="returnTo"
        :return-student-id="returnStudentId"
      />
    </div>
  </div>
</template>

<style scoped lang="scss">
.student-info-page {
  min-height: 0;
}

.student-info-page__panel {
  height: 100%;
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.08);
  overflow: hidden;
}
</style>
