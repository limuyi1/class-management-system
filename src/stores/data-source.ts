import { defineStore } from 'pinia'

import { useConfigurationStore } from '@/stores/configuration'

/**
 * 学生数据源状态管理
 * 负责存储学生数据并提供成绩统计分析计算
 */
export const useDataSourceStore = defineStore('dataSource', {
  state: () => {
    return {
      items: [] as Array<any>
    }
  },
  getters: {
    /**
     * 获取启用状态的学生数据（过滤掉禁用的学生）
     */
    enabledData(): Array<any> {
      return this.items.filter((item: any) => !item.disabled)
    },
    /**
     * 获取所有有效成绩（过滤掉 null 和 undefined 和禁用的学生）
     */
    validScores(): number[] {
      const configuration = useConfigurationStore()
      const scoreTab = configuration.inputScoreTab
      if (!scoreTab) return []
      return this.enabledData
        .map((item: any) => item[scoreTab])
        .filter((s: any): s is number => s !== null && s !== undefined)
    },
    /**
     * 学生总数（启用状态）
     */
    totalCount: (state) => state.items.filter((item: any) => !item.disabled).length as number,
    /**
     * 有效成绩数量（有分数的学生人数）
     */
    validCount(): number {
      return this.validScores.length
    },
    /**
     * 平均分
     * 计算所有有效成绩的平均值
     */
    average(): number {
      const scores = this.validScores
      if (scores.length === 0) return 0
      const sum = scores.reduce((acc: number, cur: number) => acc + cur, 0)
      return sum / scores.length
    },
    /**
     * 及格率
     * 分数 >= 60 分的学生占比
     */
    passRate(): number {
      const scores = this.validScores
      if (scores.length === 0) return 0
      const passCount = scores.filter((s: number) => s >= 60).length
      return (passCount / scores.length) * 100
    },
    /**
     * 优秀率
     * 分数 >= 80 分的学生占比
     */
    excellentRate(): number {
      const scores = this.validScores
      if (scores.length === 0) return 0
      const excellentCount = scores.filter((s: number) => s >= 80).length
      return (excellentCount / scores.length) * 100
    },
    /**
     * 最高分率
     * 分数 >= 95 分的学生占比（用于综合评分加分项）
     */
    optimumRate(): number {
      const scores = this.validScores
      if (scores.length === 0) return 0
      const optimumCount = scores.filter((s: number) => s >= 95).length
      return (optimumCount / scores.length) * 100
    },
    /**
     * 低分率
     * 分数 <= 40 分的学生占比（用于综合评分减分项）
     */
    lowScoreRate(): number {
      const scores = this.validScores
      if (scores.length === 0) return 0
      const lowCount = scores.filter((s: number) => s <= 40).length
      return (lowCount / scores.length) * 100
    },
    /**
     * 综合评分
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
    /**
     * 是否存在任何成绩数据
     * 用于判断是否显示成绩相关功能
     */
    hasAnyScore(): boolean {
      return this.validCount > 0
    }
  },
  actions: {
    /**
     * 获取指定学生的当前录入分数
     * @param item - 学生对象
     * @returns 分数，如果未设置分数列或学生没有该列的分数则返回 null
     */
    getItemScore(item: any): number | null {
      const configuration = useConfigurationStore()
      if (!configuration.inputScoreTab) return null
      return item[configuration.inputScoreTab]
    }
  }
})
