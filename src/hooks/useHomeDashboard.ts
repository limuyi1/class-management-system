import { computed, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'

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
   * 默认选中第一个有成绩的学生，保证首页首次打开时右下角趋势卡可以直接展示内容
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
   * 从右侧预警/榜单点击学生时，按“加入对比”处理，最多保留固定人数
   */
  const selectStudent = (name: string | null) => {
    if (!name) {
      selectedStudentNames.value = []
      return
    }

    const withoutCurrent = selectedStudentNames.value.filter((item) => item !== name)
    selectedStudentNames.value = [name, ...withoutCurrent].slice(
      0,
      homeDashboardConfig.studentTrend.maxCompareCount
    )
  }

  return {
    selectedStudentNames,
    dashboardData,
    selectStudent
  }
}
