import { defineStore } from 'pinia'

/**
 * 概览学情分析状态管理
 * 缓存 AI 生成的学情分析报告文本和生成时间
 */
export const useOverviewAnalysisStore = defineStore('overviewAnalysis', {
  state: () => ({
    /** AI 生成的学情分析报告（Markdown 格式） */
    analysisText: '',
    /** 报告生成时间（ISO 格式） */
    generatedAt: ''
  }),
  actions: {
    /**
     * 设置分析报告并记录生成时间
     * @param text - 分析报告内容
     */
    setAnalysis(text: string) {
      this.analysisText = text
      this.generatedAt = new Date().toISOString()
    },
    /** 清除分析报告 */
    clearAnalysis() {
      this.analysisText = ''
      this.generatedAt = ''
    }
  }
})
