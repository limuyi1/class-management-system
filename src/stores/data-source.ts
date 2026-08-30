import { defineStore } from 'pinia'
import { watch } from 'vue'

import { useConfigurationStore } from '@/stores/configuration'
import {
  computeAverage,
  computeComprehensiveRatingRate,
  computeExcellentRate,
  computeLowScoreRate,
  computeOptimumRate,
  computePassRate
} from '@/utils/scoreStatisticsUtil'
import type { StudentDataType } from '@/types/StudentData'

/**
 * 学生数据源状态管理
 * 负责存储学生数据并提供成绩统计分析计算
 * 使用 Dexie liveQuery 实现响应式数据同步
 */
export const useDataSourceStore = defineStore('dataSource', {
  state: () => {
    return {
      /** 学生数据数组 */
      students: [] as StudentDataType[],
      /** 数据是否已就绪（首次从数据库加载完成） */
      isDataReady: false,
      /** 数据初始化错误信息（null 表示无错误） */
      initError: null as string | null
    }
  },
  getters: {
    /**
     * 获取启用状态的学生数据（过滤掉禁用的学生）
     */
    enabledData(): StudentDataType[] {
      return this.students.filter((item) => item.disabled !== true)
    },
    /**
     * 获取所有有效成绩（过滤掉 null 和 undefined 和禁用的学生）
     */
    validScores(): number[] {
      const configuration = useConfigurationStore()
      const scoreTab = configuration.inputScoreTab
      if (!scoreTab) return []
      return this.enabledData
        .map((item) => item[scoreTab])
        .filter((score): score is number => typeof score === 'number' && Number.isFinite(score))
    },
    /**
     * 学生总数（启用状态）
     */
    totalCount: (state) => state.students.filter((item) => item.disabled !== true).length as number,
    /**
     * 有效成绩数量（有分数的学生人数）
     */
    validCount(): number {
      return this.validScores.length
    },
    /**
     * 平均分
     */
    average(): number {
      return computeAverage(this.validScores)
    },
    /**
     * 及格率
     */
    passRate(): number {
      return computePassRate(this.validScores)
    },
    /**
     * 优秀率
     */
    excellentRate(): number {
      return computeExcellentRate(this.validScores)
    },
    /**
     * 最高分率
     */
    optimumRate(): number {
      return computeOptimumRate(this.validScores)
    },
    /**
     * 低分率
     */
    lowScoreRate(): number {
      return computeLowScoreRate(this.validScores)
    },
    /**
     * 综合评分
     */
    comprehensiveRatingRate(): number {
      return computeComprehensiveRatingRate(this.validScores)
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
     * 按系统内部主键获取学生。
     * @param studentId - 学生唯一标识
     * @returns 匹配的学生数据，未找到返回 undefined
     */
    getStudentById(studentId: string): StudentDataType | undefined {
      return this.students.find((student) => student.studentId === studentId)
    },

    /**
     * 获取指定学生的当前录入分数
     * @param item - 学生数据
     * @returns 当前录入分数；未配置成绩列或分数非有限数字时返回 null
     */
    getItemScore(item: StudentDataType): number | null {
      const configuration = useConfigurationStore()
      const scoreTab = configuration.inputScoreTab
      if (!scoreTab) return null
      const value = item[scoreTab]
      return typeof value === 'number' && Number.isFinite(value) ? value : null
    },

    /**
     * 等待数据准备就绪
     * @returns 数据加载完成后 resolve 为 true
     */
    async waitForInitReady(): Promise<boolean> {
      if (!this.isDataReady) {
        return new Promise((resolve) => {
          const unwatch = watch(
            () => this.isDataReady,
            (ready) => {
              if (ready) {
                unwatch()
                resolve(true)
              }
            },
            { immediate: true }
          )
        })
      }
      return true
    }
  }
})
