import { computed, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { ElMessage } from 'element-plus'

import { homeDashboardConfig } from '@/config/home-dashboard'
import { useAIConfigStore } from '@/stores/ai-config'
import { useDataSourceStore } from '@/stores/data-source'
import { useSettingStore } from '@/stores/setting'
import { buildHomeDashboardData } from '@/utils/homeDashboardUntil'
import { NAME_PROP } from '@/types/Constants'

const getInitialStudentName = (students: Array<{ value: string }>): string | null => {
  return students.length ? students[0].value : null
}

export function useHomeDashboard() {
  const dataStore = useDataSourceStore()
  const settingStore = useSettingStore()
  const aiConfigStore = useAIConfigStore()

  const { enabledData } = storeToRefs(dataStore)
  const { tableHeaders } = storeToRefs(settingStore)

  const selectedStudentNames = ref<string[]>([])

  const unitHeaders = computed(() => tableHeaders.value.filter((item) => item.prop !== NAME_PROP))

  /**
   * 默认选中第一个有成绩的学生，保证打开趋势分析抽屉时可以直接展示内容
   */
  watch(
    () =>
      buildHomeDashboardData({
        students: enabledData.value,
        unitHeaders: unitHeaders.value,
        selectedStudentNames: [],
        aiConfigured: aiConfigStore.isConfigured,
        config: homeDashboardConfig
      }).studentOptions,
    (options) => {
      const validSet = new Set(options.map((item) => item.value))
      const nextSelected = selectedStudentNames.value.filter((name) => validSet.has(name))

      if (!nextSelected.length) {
        const initialName = getInitialStudentName(options)
        selectedStudentNames.value = initialName ? [initialName] : []
        return
      }

      selectedStudentNames.value = nextSelected.slice(0, homeDashboardConfig.studentTrend.maxCompareCount)
    },
    {
      immediate: true
    }
  )

  const dashboardData = computed(() =>
    buildHomeDashboardData({
      students: enabledData.value,
      unitHeaders: unitHeaders.value,
      selectedStudentNames: selectedStudentNames.value,
      aiConfigured: aiConfigStore.isConfigured,
      config: homeDashboardConfig
    })
  )

  /**
   * 从总览主页点击学生时，聚焦查看单个学生，不沿用之前的对比名单
   */
  const focusStudent = (name: string | null) => {
    selectedStudentNames.value = name ? [name] : []
  }

  /**
   * 趋势抽屉内部仍按“加入对比”处理，最多保留固定人数
   */
  const selectStudent = (name: string | null) => {
    if (!name) {
      selectedStudentNames.value = []
      return
    }

    if (
      !selectedStudentNames.value.includes(name) &&
      selectedStudentNames.value.length >= homeDashboardConfig.studentTrend.maxCompareCount
    ) {
      ElMessage.warning(`最多只能对比 ${homeDashboardConfig.studentTrend.maxCompareCount} 名学生`)
      return
    }

    const withoutCurrent = selectedStudentNames.value.filter((item) => item !== name)
    selectedStudentNames.value = [name, ...withoutCurrent]
  }

  return {
    selectedStudentNames,
    dashboardData,
    focusStudent,
    selectStudent
  }
}
