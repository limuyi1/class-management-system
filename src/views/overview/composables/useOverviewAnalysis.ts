import { computed, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { ElMessage } from 'element-plus'

import { generateLearningAnalysis } from '@/ai/aiService'
import { useAIConfigStore } from '@/stores/ai-config'
import { useOverviewAnalysisStore } from '@/stores/overview-analysis'
import { DefaultAIPrompts } from '@/types/AIConfig'
import type { DashboardDataType } from '@/types/HomeDashboard'

/**
 * 负责总览页 AI 学情分析的生成与状态同步。
 */
export function useOverviewAnalysis(dashboardData: { value: DashboardDataType }) {
  const aiConfigStore = useAIConfigStore()
  const overviewAnalysisStore = useOverviewAnalysisStore()
  const { analysisText, generatedAt } = storeToRefs(overviewAnalysisStore)
  const loading = ref(false)

  /**
   * 仅提取 AI 提示词真正需要的字段，避免把整个页面状态无差别塞给模型。
   */
  const payload = computed<Record<string, unknown>>(() => {
    const data = dashboardData.value

    return {
      kpi: {
        averageScore: data.kpi.averageScore,
        averagePassRate: data.kpi.averagePassRate,
        passRateFluctuation: data.kpi.passRateFluctuation,
        attentionStudentCount: data.kpi.attentionStudentCount,
        completedUnitCount: data.kpi.completedUnitCount
      },
      summaryCards: data.summaryCards,
      unitOverview: data.unitOverview.map((unit) => ({
        label: unit.label,
        averageScore: unit.averageScore,
        validCount: unit.validCount,
        scoreBands: unit.scoreBands.map((band) => ({
          label: band.label,
          count: band.count
        }))
      })),
      teachingInsights: data.teachingInsights,
      focusGroups: data.focusGroups.map((group) => ({
        label: group.label,
        sections: group.sections.map((section) => ({
          label: section.label,
          items: section.items.slice(0, 6)
        }))
      })),
      keyStudentLists: data.keyStudentLists.map((list) => ({
        label: list.label,
        items: list.items.slice(0, 6)
      }))
    }
  })

  const generateAnalysis = async () => {
    if (!aiConfigStore.isConfigured) {
      return false
    }

    loading.value = true
    try {
      const result = await generateLearningAnalysis(
        payload.value,
        aiConfigStore.prompts.learningAnalysis || DefaultAIPrompts.learningAnalysis,
        {
          modelType: aiConfigStore.modelType,
          model: aiConfigStore.model,
          apiKey: aiConfigStore.apiKey,
          baseUrl: aiConfigStore.baseUrl
        }
      )

      overviewAnalysisStore.setAnalysis(result.trim())
      ElMessage.success('AI 学情分析已生成')
      return true
    } catch (error) {
      console.error('Failed to generate learning analysis:', error)
      ElMessage.error('生成学情分析失败，请检查 AI 配置')
      return false
    } finally {
      loading.value = false
    }
  }

  return {
    analysisText,
    generatedAt,
    loading,
    generateAnalysis
  }
}
