import { defineStore, storeToRefs } from 'pinia'
import { useConfigurationStore } from '@/stores/configuration'

export const useDataSourceStore = defineStore('dataSource', {
  state: () => {
    return {
      data: [] as Array<any>
    }
  },
  getters: {
    getScore() {
      return (item: any): number | null => {
        const configuration = useConfigurationStore()
        const { data: config } = storeToRefs(configuration)
        if (!config.value.inputScoreTab) return null
        return item[config.value.inputScoreTab]
      }
    },
    validScores(): number[] {
      return this.data
        .map((item: any) => this.getScore(item))
        .filter((s: any): s is number => s !== null && s !== undefined)
    },
    totalCount: (state) => state.data.length as number,
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
    /**
     * 综合评分计算公式
     * 综合评分 = 平均分×0.4 + 及格率×0.3 + 优秀率×0.3 + 最高分率×0.05 - 低分率×0.05
     * 权重说明：
     * - 平均分占40%，反映整体水平
     * - 及格率占30%，反映基础掌握情况
     * - 优秀率占30%，反映高分学生比例
     * - 最高分率作为加分项，鼓励拔尖
     * - 低分率作为减分项，惩罚大面积失分
     */
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
