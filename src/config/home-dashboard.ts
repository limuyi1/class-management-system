import type { HomeDashboardConfigType } from '@/types/HomeDashboard'

/**
 * 首页学情总览配置
 * 集中维护首页统计规则，避免阈值散落在组件和 hook 中
 */
export const homeDashboardConfig: HomeDashboardConfigType = {
  unitOverview: {
    // 单元概览图固定展示的分数段，平均分之外的辅助信息都从这里读取
    scoreBands: [
      { label: '90-100', min: 90, max: 100, color: '#52c41a' },
      { label: '80-89', min: 80, max: 89, color: '#b7eb8f' },
      { label: '70-79', min: 70, max: 79, color: '#1890ff' },
      { label: '60-69', min: 60, max: 69, color: '#faad14' },
      { label: '60以下', min: 0, max: 59, color: '#f5222d' }
    ],
    // 单元数量超过该值时才出现横向滚动条，避免只有少量单元时也显示滑块
    dataZoomThreshold: 6,
    // 横向滚动开启后，默认一屏展示的单元数量
    dataZoomVisibleCount: 6
  },
  alerts: {
    // 低于该分数线会被视作低分，用于持续低分和个人摘要判断
    lowScoreLine: 60,
    // 至少有 2 个单元低于低分线，才认定为持续低分
    persistentLowScoreMinCount: 2,
    // 至少有 2 个单元成绩，才有资格参与“波动最大”预警
    maxFluctuationMinUnits: 2,
    // 最高分与最低分相差达到 20 分及以上，才进入“波动最大”预警
    maxFluctuationMinRange: 20,
    // 最近一次成绩比历史均分低 8 分及以上，才进入“下滑关注”
    declineMinDrop: 8,
    // 首页预警卡片默认预览前 3 人
    displayCount: 3,
    // 首页首屏紧凑模式每类露出前 6 人，按三列两行展示
    compactDisplayCount: 6,
    // 展开后仍控制列表高度，每类最多展示前 5 人
    expandedDisplayCount: 5
  },
  rankings: {
    // 首页榜单每类只展示前 3 名，控制首页密度
    displayCount: 3,
    // 首页首屏紧凑模式每类露出前 4 名，单项内按两列两行展示
    compactDisplayCount: 4,
    // “稳定前五”表示统计进入班级前 5 的次数
    stableTopRankLimit: 5,
    // 至少有 2 个单元成绩，才参与“进步最大”和“下滑关注”的阶段趋势判断
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
    // 学生趋势对比控制在 5 人内，兼顾对比范围和图表可读性
    maxCompareCount: 5
  }
}
