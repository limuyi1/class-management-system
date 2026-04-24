import { defineStore } from 'pinia'

export const useOverviewAnalysisStore = defineStore('overviewAnalysis', {
  state: () => ({
    analysisText: '',
    generatedAt: ''
  }),
  actions: {
    setAnalysis(text: string) {
      this.analysisText = text
      this.generatedAt = new Date().toISOString()
    },
    clearAnalysis() {
      this.analysisText = ''
      this.generatedAt = ''
    }
  }
})
