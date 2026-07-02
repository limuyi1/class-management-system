<script setup lang="ts">
import { computed, defineAsyncComponent, nextTick, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'

import { useDataSourceStore } from '@/stores/data-source'

const StudentInfo = defineAsyncComponent(() => import('@/views/setting/components/StudentInfo.vue'))

const route = useRoute()
const router = useRouter()
const dataSourceStore = useDataSourceStore()
const { enabledData } = storeToRefs(dataSourceStore)

const hasStudentData = computed(() => enabledData.value.length > 0)
const studentInfoRef = ref<InstanceType<typeof StudentInfo>>()
const pendingTagEditorStudent = ref('')
const returnTo = ref('')
const returnStudentName = ref('')

const clearEditTagsQuery = async () => {
  await router.replace({ path: '/student-info' })
}

const syncEditTagsQuery = async () => {
  if (route.query['edit-tags'] !== '1') return

  const studentName = route.query['student-name']
  if (typeof studentName !== 'string' || !studentName) return

  returnTo.value = typeof route.query['return-to'] === 'string' ? route.query['return-to'] : ''
  returnStudentName.value =
    typeof route.query['return-student-name'] === 'string' ? route.query['return-student-name'] : ''

  await nextTick()

  if (!studentInfoRef.value) {
    pendingTagEditorStudent.value = studentName
    return
  }

  studentInfoRef.value.openTagEditorByName(studentName)
  pendingTagEditorStudent.value = ''
  await clearEditTagsQuery()
}

watch(
  hasStudentData,
  async (hasData) => {
    if (hasData) return
    await router.replace('/tools')
  },
  { immediate: true }
)

watch(
  () => route.query,
  () => {
    syncEditTagsQuery()
  },
  { immediate: true }
)

watch(studentInfoRef, async (instance) => {
  if (!instance || !pendingTagEditorStudent.value) return

  instance.openTagEditorByName(pendingTagEditorStudent.value)
  pendingTagEditorStudent.value = ''
  await clearEditTagsQuery()
})
</script>

<template>
  <div class="student-info-page app-page-shell">
    <div class="student-info-page__panel">
      <student-info
        ref="studentInfoRef"
        :return-to="returnTo"
        :return-student-name="returnStudentName"
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
