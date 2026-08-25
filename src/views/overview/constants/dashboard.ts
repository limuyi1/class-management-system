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
      { label: '90-100', min: 90, max: 100, color: '#16a34a' },
      { label: '80-89', min: 80, max: 89, color: '#0d9488' },
      { label: '70-79', min: 70, max: 79, color: '#2563eb' },
      { label: '60-69', min: 60, max: 69, color: '#d97706' },
      { label: '60以下', min: 0, max: 59, color: '#dc2626' }
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
    // 单元均分较近期正常单元基线变化达到该阈值时，认为本次整体偏难/偏易
    latestUnitDifficultyShiftThreshold: 5,
    // 至少参考最近 N 个已完成单元，单元数不足时不做相对难度判断
    unitDifficultyBaselineWindow: 3,
    // 绝对均分边界，单元数较少时仅用这些强信号判断明显偏易/偏难
    easyUnitAverageScore: 85,
    hardUnitAverageScore: 65,
    // 四类标签分组，用于 UI 颜色和展示位置区分
    tagGroups: {
      // 需要优先处理的风险分组
      attention: {
        label: '立即关注',
        tone: 'danger'
      },
      // 表现积极、值得表扬的分组
      encouragement: {
        label: '值得鼓励',
        tone: 'success'
      },
      // 处于中段且正在变化的分组
      middleChange: {
        label: '中段变化',
        tone: 'info'
      },
      // 成绩起伏较大的观察分组
      volatilityWatch: {
        label: '波动观察',
        tone: 'warning'
      }
    },
    tags: {
      // 突发异常：最新成绩较个人历史水平出现一次性明显失常
      abnormal: {
        label: '突发异常',
        enabled: true,
        group: 'attention',
        priority: 2,
        recentWindow: 3, // 参与判定的最近单元数
        description: '本次成绩明显异常，和个人平时水平不符',
        abnormalDrop: 12, // 较历史均分的异常降幅阈值（分）
        minValidScores: 3 // 最少有效成绩数，不足则不判定
      },
      // 持续低分：最近窗口内多次处于低分状态
      persistentLowScore: {
        label: '持续低分',
        enabled: true,
        group: 'attention',
        priority: 4,
        recentWindow: 3, // 参与判定的最近单元数
        description: '最近阶段连续处于低分状态',
        minHitCount: 2, // 窗口内低于及格线的最少次数
        minValidScores: 2 // 最少有效成绩数
      },
      // 下滑关注：近期成绩连续走低且跌幅明显，或单次出现较大下滑
      declining: {
        label: '下滑关注',
        enabled: true,
        group: 'attention',
        priority: 1,
        recentWindow: 3, // 参与判定的最近单元数
        description: '近期成绩连续走低且跌幅明显，或单次出现较大下滑',
        minCumulativeDrop: 5, // 连续下滑的累计跌幅阈值（分）
        minSingleDrop: 5, // 单次下滑幅度阈值（分）
        minDelta: 8, // 相对近期均值的显著下降阈值（分）
        minValidScores: 3 // 最少有效成绩数
      },
      // 临界生：接近及格线，稍加辅导有机会跨线
      critical: {
        label: '临界生',
        enabled: true,
        group: 'attention',
        priority: 3,
        recentWindow: 1, // 仅考察最近一次成绩
        description: '接近及格线，稍加辅导有机会跨线',
        minScore: 55, // 临界分数区间下限
        maxScore: 64, // 临界分数区间上限
        minValidScores: 1 // 最少有效成绩数
      },
      // 低位回升：原本成绩偏低，最近开始明显回升
      lowRecovery: {
        label: '低位回升',
        enabled: true,
        group: 'encouragement',
        priority: 5,
        recentWindow: 3, // 参与判定的最近单元数
        description: '原本成绩偏低，最近开始明显回升',
        minHitCount: 2, // 前期历史成绩中出现低分的最少次数
        minValidScores: 3 // 最少有效成绩数
      },
      // 进步明显：最近阶段持续进步，提升明显
      improving: {
        label: '进步明显',
        enabled: true,
        group: 'encouragement',
        priority: 6,
        recentWindow: 3, // 参与判定的最近单元数
        description: '最近阶段持续进步，提升明显',
        minDelta: 8, // 显著进步的最小提升幅度（分）
        minValidScores: 2 // 最少有效成绩数
      },
      // 中段下滑：处于班级中间层，但最近持续退步
      middleFalling: {
        label: '中段下滑',
        enabled: true,
        group: 'middleChange',
        priority: 7,
        recentWindow: 3, // 参与判定的最近单元数
        description: '处于班级中间层，但最近持续退步',
        minDelta: 8, // 显著退步的最小下降幅度（分）
        minValidScores: 3 // 最少有效成绩数
      },
      // 中段上升：处于班级中间层，但最近持续进步
      middleRising: {
        label: '中段上升',
        enabled: true,
        group: 'middleChange',
        priority: 8,
        recentWindow: 3, // 参与判定的最近单元数
        description: '处于班级中间层，但最近持续进步',
        minDelta: 8, // 显著进步的最小提升幅度（分）
        minValidScores: 3 // 最少有效成绩数
      },
      // 波动生：最近几次成绩起伏较大，状态不稳定
      volatility: {
        label: '波动生',
        enabled: true,
        group: 'volatilityWatch',
        priority: 9,
        recentWindow: 4, // 参与判定的最近单元数
        description: '最近几次成绩起伏较大，状态不稳定',
        stdDevThreshold: 10, // 标准差阈值，超过则判定为波动
        minValidScores: 3 // 最少有效成绩数
      },
      // 高分稳定：近期稳定处于班级前列
      stableTop: {
        label: '高分稳定',
        enabled: true,
        group: 'encouragement',
        priority: 10,
        recentWindow: 3, // 参与判定的最近单元数
        description: '近期稳定处于班级前列',
        minTopRankHits: 2, // 窗口内进入班级前列的最少次数
        topRankLimit: 5, // 班级前列的定义（前 N 名）
        minValidScores: 3 // 最少有效成绩数
      }
    }
  },
  // 趋势分析相关阈值
  studentTrend: {
    lowScoreLine: 60, // 低分线，用于低分相关判断
    highFluctuationRange: 20, // 极差超过该值视为波动较大
    significantRise: 8, // 显著回升阈值（相对历史均分，分）
    significantDrop: 8, // 显著下降阈值（相对历史均分，分）
    summaryLimit: 3, // 摘要最多展示条数
    maxCompareCount: 3 // 最多同时对比的学生数
  },
  // 推荐排序权重配置，用于计算学生在本组内的推荐优先级
  recommendation: {
    maxItemsPerGroup: 3, // 每组最多推荐展示的学生数
    attentionWeights: {
      abnormalDrop: 3, // 异常下滑幅度的权重
      lowScoreHit: 2, // 低分命中次数的权重
      declineDelta: 2, // 下滑幅度的权重
      multiTagBonus: 1 // 多标签叠加的加成
    },
    encouragementWeights: {
      riseDelta: 3, // 上升幅度的权重
      recoveryBonus: 2, // 低位回升的加成
      stableTopBonus: 1 // 高分稳定的加成
    },
    middleChangeWeights: {
      fallingDelta: 3, // 中段下滑幅度的权重
      volatility: 2, // 波动程度的权重
      risingDelta: 1 // 中段上升幅度的权重
    }
  }
}
