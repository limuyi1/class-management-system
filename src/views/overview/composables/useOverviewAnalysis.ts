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
      指标概览: {
        班级均分: data.kpi.averageScore,
        平均及格率: `${data.kpi.averagePassRate}%`,
        单元及格率波动值: `${data.kpi.passRateFluctuation}%`,
        重点关注学生人数: data.kpi.attentionStudentCount,
        已完成单元数: data.kpi.completedUnitCount,
        单元总数: data.kpi.totalUnitCount,
        波动最明显单元: data.kpi.biggestFluctuationUnitLabel,
        诊断摘要: data.kpi.diagnosticText
      },
      概览卡片: data.summaryCards.map((card) => ({
        名称: card.label,
        数值: card.unit ? `${card.value}${card.unit}` : card.value,
        摘要: card.summary,
        明细: card.details.map((detail) => ({
          名称: detail.label,
          数值: detail.value
        }))
      })),
      单元表现: data.unitOverview.map((unit) => ({
        单元名称: unit.label,
        平均分: unit.averageScore,
        有效人数: unit.validCount,
        分段分布: unit.scoreBands.map((band) => ({
          分段: band.label,
          人数: band.count
        }))
      })),
      教学提示: data.teachingInsights.map((item) => ({
        主题: item.label,
        内容: item.value
      })),
      关注分组: data.focusGroups.map((group) => ({
        分组名称: group.label,
        小节: group.sections.map((section) => ({
          小节名称: section.label,
          说明: section.description,
          学生列表: section.items.slice(0, 6).map((item) => ({
            姓名: item.name,
            趋势: item.trendText,
            摘要: item.subtitle,
            提示标签: item.badge,
            原因: item.reasonText
          }))
        }))
      })),
      重点学生名单: data.keyStudentLists.map((list) => ({
        名单名称: list.label,
        学生列表: list.items.slice(0, 6).map((item) => ({
          姓名: item.name,
          趋势: item.trendText,
          摘要: item.subtitle,
          提示标签: item.badge,
          原因: item.reasonText
        }))
      }))
    }
  })

  /**
   * 调用 AI 生成学情分析并写入 store。
   *
   * @returns 是否成功生成
   */
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
