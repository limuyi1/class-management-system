import { computed, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { ElMessage } from 'element-plus'

import { overviewDashboardConfig } from '@/views/overview/constants/dashboard'
import { buildDashboardData } from '@/views/overview/services/dashboard'
import { useAIConfigStore } from '@/stores/ai-config'
import { useDataSourceStore } from '@/stores/data-source'
import { useSettingStore } from '@/stores/setting'
import { NAME_PROP } from '@/types/Constants'

const getInitialStudentName = (students: Array<{ value: string }>): string | null => {
  return students.length ? students[0].value : null
}

/**
 * 管理总览页的核心状态：
 * 1. 从 store 构建展示数据
 * 2. 维护趋势分析的选中学生
 * 3. 兜底处理默认选中和人数限制
 */
export function useOverviewDashboard() {
  const dataStore = useDataSourceStore()
  const settingStore = useSettingStore()
  const aiConfigStore = useAIConfigStore()

  const { enabledData } = storeToRefs(dataStore)
  const { scoreColumns } = storeToRefs(settingStore)

  const selectedStudentNames = ref<string[]>([])

  const unitHeaders = computed(() => scoreColumns.value.filter((item) => item.prop !== NAME_PROP))

  /**
   * 数据源变化后，重新校验当前选中学生是否仍然有效。
   *
   * 监听逻辑：
   * 1. 从 buildDashboardData 获取当前有效的学生列表（studentOptions）
   * 2. 检查 selectedStudentNames 中的学生是否仍在有效列表中
   * 3. 若全部失效，自动选择首个学生作为兜底
   * 4. 若超出最大对比人数，自动截断
   *
   * 使用 studentOptions 而非直接监听 enabledData，是因为需要确保学生姓名稳定。
   */
  watch(
    () =>
      buildDashboardData({
        students: enabledData.value,
        unitHeaders: unitHeaders.value,
        selectedStudentNames: [],
        aiConfigured: aiConfigStore.isConfigured,
        config: overviewDashboardConfig
      }).studentOptions,
    (options) => {
      const validSet = new Set(options.map((item) => item.value))
      const nextSelected = selectedStudentNames.value.filter((name) => validSet.has(name))

      if (!nextSelected.length) {
        const initialName = getInitialStudentName(options)
        selectedStudentNames.value = initialName ? [initialName] : []
        return
      }

      selectedStudentNames.value = nextSelected.slice(
        0,
        overviewDashboardConfig.studentTrend.maxCompareCount
      )
    },
    {
      immediate: true
    }
  )

  const dashboardData = computed(() =>
    buildDashboardData({
      students: enabledData.value,
      unitHeaders: unitHeaders.value,
      selectedStudentNames: selectedStudentNames.value,
      aiConfigured: aiConfigStore.isConfigured,
      config: overviewDashboardConfig
    })
  )

  /**
   * 从总览卡片点击学生时，进入单人聚焦模式。
   */
  const focusStudent = (name: string | null) => {
    selectedStudentNames.value = name ? [name] : []
  }

  /**
   * 抽屉内部维持“添加到对比”交互，超出上限时直接拦截。
   */
  const selectStudent = (name: string | null) => {
    if (!name) {
      selectedStudentNames.value = []
      return
    }

    if (
      !selectedStudentNames.value.includes(name) &&
      selectedStudentNames.value.length >= overviewDashboardConfig.studentTrend.maxCompareCount
    ) {
      ElMessage.warning(`最多只能对比 ${overviewDashboardConfig.studentTrend.maxCompareCount} 名学生`)
      return
    }

    const withoutCurrent = selectedStudentNames.value.filter((item) => item !== name)
    selectedStudentNames.value = [...withoutCurrent, name]
  }

  return {
    selectedStudentNames,
    dashboardData,
    focusStudent,
    selectStudent
  }
}
