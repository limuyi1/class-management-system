import { defineStore } from 'pinia'
import { liveQuery, type Observable } from 'dexie'

import { db, DB_ID } from '@/db'
import { useConfigurationStore } from '@/stores/configuration'

/**
 * 学生数据源状态管理
 * 负责存储学生数据并提供成绩统计分析计算
 * 使用 Dexie liveQuery 实现响应式数据同步
 */
export const useDataSourceStore = defineStore('dataSource', {
  state: () => {
    return {
      items: [] as Array<any>,
      _isUpdatingFromDB: false as boolean
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
     */
    hasAnyScore(): boolean {
      return this.validCount > 0
    }
  },
  actions: {
    /**
     * 获取指定学生的当前录入分数
     */
    getItemScore(item: any): number | null {
      const configuration = useConfigurationStore()
      if (!configuration.inputScoreTab) return null
      return item[configuration.inputScoreTab]
    },

    /**
     * 从数据库订阅实时数据
     * 使用 Dexie liveQuery，当 IndexedDB 变化时自动更新 store
     */
    subscribeToLiveQuery() {
      const observable$ = liveQuery(() => db.dataSource.get(DB_ID)) as Observable<any>

      observable$.subscribe({
        next: async (record) => {
          if (!record) return

          this._isUpdatingFromDB = true

          const newData = record.data || []
          this.items = newData

          await new Promise((resolve) => setTimeout(resolve, 0))
          this._isUpdatingFromDB = false
        },
        error: (err) => {
          console.error('[dataSource] LiveQuery error:', err)
        }
      })
    },

    /**
     * 初始化数据库并建立订阅
     */
    async initDatabase() {
      const record = await db.dataSource.get(DB_ID)
      if (!record) {
        await db.dataSource.put({
          id: DB_ID,
          data: []
        })
      }
      this.subscribeToLiveQuery()
    },

    /**
     * 保存当前状态到数据库
     * 当 Store 状态变化时调用
     */
    async saveToDatabase() {
      if (this._isUpdatingFromDB) {
        return
      }

      try {
        await db.dataSource.put({
          id: DB_ID,
          data: this.items
        })
      } catch (error) {
        console.error('[dataSource] Failed to save to database:', error)
      }
    }
  }
})
