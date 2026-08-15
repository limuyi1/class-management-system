import { computed, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { ElMessage } from 'element-plus'

import { overviewDashboardConfig } from '@/views/overview/constants/dashboard'
import { buildDashboardData } from '@/views/overview/services/dashboard'
import { useAIConfigStore } from '@/stores/ai-config'
import { useDataSourceStore } from '@/stores/data-source'
import { useSettingStore } from '@/stores/setting'

/** 返回学生选项列表中的首个学生 ID，空列表返回 null */
const getInitialStudentId = (students: Array<{ value: string }>): string | null => {
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
  const { enabledScoreColumns: unitHeaders } = storeToRefs(settingStore)

  const selectedStudentIds = ref<string[]>([])

  /**
   * 数据源变化后，重新校验当前选中学生是否仍然有效。
   *
   * 监听逻辑：
   * 1. 从 buildDashboardData 获取当前有效的学生列表（studentOptions）
   * 2. 检查 selectedStudentIds 中的学生是否仍在有效列表中
   * 3. 若全部失效，自动选择首个学生作为兜底
   * 4. 若超出最大对比人数，自动截断
   *
   * 使用 studentOptions 而非直接监听 enabledData，确保选择状态始终以稳定 ID 为准。
   */
  watch(
    () =>
      buildDashboardData({
        students: enabledData.value,
        unitHeaders: unitHeaders.value,
        selectedStudentIds: [],
        aiConfigured: aiConfigStore.isConfigured,
        config: overviewDashboardConfig
      }).studentOptions,
    (options) => {
      const validSet = new Set(options.map((item) => item.value))
      const nextSelected = selectedStudentIds.value.filter((studentId) => validSet.has(studentId))

      if (!nextSelected.length) {
        const initialStudentId = getInitialStudentId(options)
        selectedStudentIds.value = initialStudentId ? [initialStudentId] : []
        return
      }

      selectedStudentIds.value = nextSelected.slice(
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
      selectedStudentIds: selectedStudentIds.value,
      aiConfigured: aiConfigStore.isConfigured,
      config: overviewDashboardConfig
    })
  )

  /**
   * 从总览卡片点击学生时，进入单人聚焦模式。
   */
  const focusStudent = (studentId: string | null) => {
    selectedStudentIds.value = studentId ? [studentId] : []
  }

  /**
   * 抽屉内部维持“添加到对比”交互，超出上限时直接拦截。
   */
  const selectStudent = (studentId: string | null) => {
    if (!studentId) {
      selectedStudentIds.value = []
      return
    }

    if (
      !selectedStudentIds.value.includes(studentId) &&
      selectedStudentIds.value.length >= overviewDashboardConfig.studentTrend.maxCompareCount
    ) {
      ElMessage.warning(`最多只能对比 ${overviewDashboardConfig.studentTrend.maxCompareCount} 名学生`)
      return
    }

    const withoutCurrent = selectedStudentIds.value.filter((item) => item !== studentId)
    selectedStudentIds.value = [...withoutCurrent, studentId]
  }

  return {
    selectedStudentIds,
    dashboardData,
    focusStudent,
    selectStudent
  }
}
