import { defineStore, storeToRefs } from 'pinia'
import { useConfigurationStore } from '@/stores/configuration'

export const useDataSourceStore = defineStore('dataSource', {
  state: () => {
    return {
      data: [] as Array<any>
    }
  },
  getters: {
    getScore:
      (state) =>
      (item: any): number | null => {
        const configuration = useConfigurationStore()
        const { data: config } = storeToRefs(configuration)
        if (!config.value.inputScoreTab) return null
        return item[config.value.inputScoreTab]
      },
    validScores(): number[] {
      return this.data
        .map((item: any) => this.getScore(item))
        .filter((s: any): s is number => s !== null && s !== undefined)
    },
    totalCount: (state) => state.data.length,
    validCount(): number {
      return this.validScores.length
    },
    average(): number {
      const scores = this.validScores
      if (scores.length === 0) return 0
      const sum = scores.reduce((acc: number, cur: number) => acc + cur, 0)
      return sum / scores.length
    },
    passRate(): number {
      const scores = this.validScores
      if (scores.length === 0) return 0
      const passCount = scores.filter((s: number) => s >= 60).length
      return (passCount / scores.length) * 100
    },
    excellentRate(): number {
      const scores = this.validScores
      if (scores.length === 0) return 0
      const excellentCount = scores.filter((s: number) => s >= 80).length
      return (excellentCount / scores.length) * 100
    },
    optimumRate(): number {
      const scores = this.validScores
      if (scores.length === 0) return 0
      const optimumCount = scores.filter((s: number) => s >= 95).length
      return (optimumCount / scores.length) * 100
    },
    lowScoreRate(): number {
      const scores = this.validScores
      if (scores.length === 0) return 0
      const lowCount = scores.filter((s: number) => s <= 40).length
      return (lowCount / scores.length) * 100
    },
    comprehensiveRatingRate(): number {
      if (this.validCount === 0) return 0
      return (
        this.average * 0.4 +
        (this.passRate / 100) * 0.3 +
        (this.excellentRate / 100) * 0.3 +
        (this.optimumRate / 100) * 0.05 -
        (this.lowScoreRate / 100) * 0.05
      )
    },
    hasAnyScore(): boolean {
      return this.validCount > 0
    }
  },
  persist: true
})
