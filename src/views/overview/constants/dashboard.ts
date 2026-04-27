import type { HomeDashboardConfigType } from '@/types/HomeDashboard'

/**
 * 班级总览页配置。
 * 统一维护统计阈值、分组规则和推荐策略，避免业务规则散落在组件中。
 *
 * 配置结构说明：
 * - unitOverview：单元概览的分数段定义
 * - tagRules：标签匹配规则和分组定义
 * - studentTrend：趋势分析的阈值配置
 * - recommendation：推荐权重配置
 */
export const overviewDashboardConfig: HomeDashboardConfigType = {
  unitOverview: {
    // 分数段定义，用于柱状图的颜色分区和人数统计
    scoreBands: [
      { label: '90-100', min: 90, max: 100, color: '#52c41a' },
      { label: '80-89', min: 80, max: 89, color: '#b7eb8f' },
      { label: '70-79', min: 70, max: 79, color: '#1890ff' },
      { label: '60-69', min: 60, max: 69, color: '#faad14' },
      { label: '60以下', min: 0, max: 59, color: '#f5222d' }
    ],
    // 当单元数超过此阈值时，显示缩放控制器
    dataZoomThreshold: 6,
    // 缩放时默认可见的单元数
    dataZoomVisibleCount: 6
  },
  tagRules: {
    passLine: 60,      // 及格线，低于此分数视为低分
    middleScoreMin: 60, // 中段分数下限
    middleScoreMax: 84,  // 中段分数上限（不含）
    // 最近单元班均较上一单元变化达到该阈值时，认为本次整体偏难/偏易
    latestUnitDifficultyShiftThreshold: 5,
    // 四类标签分组，用于 UI 颜色和展示位置区分
    tagGroups: {
      attention: {
        label: '立即关注',
        tone: 'danger'
      },
      encouragement: {
        label: '值得鼓励',
        tone: 'success'
      },
      middleChange: {
        label: '中段变化',
        tone: 'info'
      },
      volatilityWatch: {
        label: '波动观察',
        tone: 'warning'
      }
    },
    tags: {
      abnormal: {
        label: '突发异常',
        enabled: true,
        group: 'attention',
        priority: 2,
        recentWindow: 3,
        description: '本次成绩明显异常，和个人平时水平不符',
        abnormalDrop: 12,
        minValidScores: 3
      },
      persistentLowScore: {
        label: '持续低分',
        enabled: true,
        group: 'attention',
        priority: 4,
        recentWindow: 3,
        description: '最近阶段连续处于低分状态',
        minHitCount: 2,
        minValidScores: 2
      },
      declining: {
        label: '下滑关注',
        enabled: true,
        group: 'attention',
        priority: 1,
        recentWindow: 3,
        description: '近期成绩连续走低且跌幅明显，或单次出现较大下滑',
        minCumulativeDrop: 5,
        minSingleDrop: 5,
        minDelta: 8,
        minValidScores: 3
      },
      critical: {
        label: '临界生',
        enabled: true,
        group: 'attention',
        priority: 3,
        recentWindow: 1,
        description: '接近及格线，稍加辅导有机会跨线',
        minScore: 55,
        maxScore: 64,
        minValidScores: 1
      },
      lowRecovery: {
        label: '低位回升',
        enabled: true,
        group: 'encouragement',
        priority: 5,
        recentWindow: 3,
        description: '原本成绩偏低，最近开始明显回升',
        minHitCount: 2,
        minValidScores: 3
      },
      improving: {
        label: '进步明显',
        enabled: true,
        group: 'encouragement',
        priority: 6,
        recentWindow: 3,
        description: '最近阶段持续进步，提升明显',
        minDelta: 8,
        minValidScores: 2
      },
      middleFalling: {
        label: '中段下滑',
        enabled: true,
        group: 'middleChange',
        priority: 7,
        recentWindow: 3,
        description: '处于班级中间层，但最近持续退步',
        minDelta: 8,
        minValidScores: 3
      },
      middleRising: {
        label: '中段上升',
        enabled: true,
        group: 'middleChange',
        priority: 8,
        recentWindow: 3,
        description: '处于班级中间层，但最近持续进步',
        minDelta: 8,
        minValidScores: 3
      },
      volatility: {
        label: '波动生',
        enabled: true,
        group: 'volatilityWatch',
        priority: 9,
        recentWindow: 4,
        description: '最近几次成绩起伏较大，状态不稳定',
        stdDevThreshold: 10,
        minValidScores: 3
      },
      stableTop: {
        label: '高分稳定',
        enabled: true,
        group: 'encouragement',
        priority: 10,
        recentWindow: 3,
        description: '近期稳定处于班级前列',
        minTopRankHits: 2,
        topRankLimit: 5,
        minValidScores: 3
      }
    }
  },
  // 趋势分析相关阈值
  studentTrend: {
    lowScoreLine: 60,
    highFluctuationRange: 20,
    significantRise: 8,
    significantDrop: 8,
    summaryLimit: 3,
    maxCompareCount: 3
  },
  // 推荐排序权重配置，用于计算学生在本组内的推荐优先级
  recommendation: {
    maxItemsPerGroup: 3,
    attentionWeights: {
      abnormalDrop: 3,
      lowScoreHit: 2,
      declineDelta: 2,
      multiTagBonus: 1
    },
    encouragementWeights: {
      riseDelta: 3,
      recoveryBonus: 2,
      stableTopBonus: 1
    },
    middleChangeWeights: {
      fallingDelta: 3,
      volatility: 2,
      risingDelta: 1
    }
  }
}
