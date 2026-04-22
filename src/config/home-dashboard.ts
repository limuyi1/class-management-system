import type { HomeDashboardConfigType } from '@/types/HomeDashboard'

/**
 * 首页学情总览配置
 * 集中维护首页统计规则，避免阈值散落在组件和 hook 中
 */
export const homeDashboardConfig: HomeDashboardConfigType = {
  unitOverview: {
    // 单元概览图固定展示的分数段，平均分之外的辅助信息都从这里读取
    scoreBands: [
      { label: '90-100', min: 90, max: 100, color: '#16a34a' },
      { label: '80-89', min: 80, max: 89, color: '#2563eb' },
      { label: '70-79', min: 70, max: 79, color: '#f59e0b' },
      { label: '60-69', min: 60, max: 69, color: '#f97316' },
      { label: '60以下', min: 0, max: 59, color: '#ef4444' }
    ]
  },
  alerts: {
    // 低于该分数线会被视作低分，用于持续低分和个人摘要判断
    lowScoreLine: 60,
    // 至少有 2 个单元低于低分线，才认定为持续低分
    persistentLowScoreMinCount: 2,
    // 至少有 2 个单元成绩，才有资格参与“波动最大”预警
    maxFluctuationMinUnits: 2,
    // 最近一次成绩比历史均分低 8 分及以上，才进入“明显下滑”
    declineMinDrop: 8,
    // 首页预警卡片默认预览前 3 人，可通过展开查看完整名单
    displayCount: 3
  },
  rankings: {
    // 首页榜单每类只展示前 3 名，控制首页密度
    displayCount: 3,
    // “稳定前五”表示统计进入班级前 5 的次数
    stableTopRankLimit: 5,
    // 至少有 2 个单元成绩，才参与“进步最大/退步明显”阶段榜单
    minUnitsForTrend: 2
  },
  studentTrend: {
    // 个人趋势卡里沿用首页统一低分线
    lowScoreLine: 60,
    // 分差达到 20 分及以上时，摘要提示“波动较大”
    highFluctuationRange: 20,
    // 最近成绩高于历史均分 8 分及以上，提示“回升明显”
    significantRise: 8,
    // 最近成绩低于历史均分 8 分及以上，提示“下降明显”
    significantDrop: 8,
    // 首页个人趋势卡只保留最多 3 条摘要，避免信息过载
    summaryLimit: 3,
    // 学生趋势对比先控制在 3 人内，避免图表过于拥挤
    maxCompareCount: 3
  }
}
