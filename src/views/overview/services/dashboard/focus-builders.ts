/** 关注分组与重点学生列表组装。 */
import {
  getMiddleChangeDisplayKey,
  getRecommendScore,
  getSectionMeta,
  getTagSortScore,
  toStudentListItem
} from '@/views/overview/services/dashboard/student-list'

import type {
  DashboardFocusGroupKeyType,
  DashboardFocusGroupType,
  DashboardFocusSectionKeyType,
  DashboardFocusSectionType,
  DashboardKeyStudentListType,
  DashboardStudentListItemType,
  DashboardTagKeyType,
  OverviewDashboardConfigType
} from '@/types/OverviewDashboard'
import type { StudentMetricType } from '@/views/overview/services/dashboard/types'

/**
 * 生成总览页右侧”学生观察站”的分组结构。
 *
 * 分组结构：四类标签组（立即关注/值得鼓励/中段变化/波动观察），
 * 每组下包含多个标签区块（如”突发异常”、”下滑关注”等）。
 * 区块内的学生按推荐分数排序，同一标签优先展示。
 * 波动标签会被细分为”波动上行”和”波动下行”两个区块。
 *
 * @param metrics 学生画像列表
 * @param config 总览页配置
 * @returns 四类标签分组及其区块结构
 */
export const buildFocusGroups = (
  metrics: StudentMetricType[],
  config: OverviewDashboardConfigType
): DashboardFocusGroupType[] => {
  const tagGroups = config.tagRules.tagGroups
  // 展平启用的标签并按 priority 升序排列，保证后续区块的生成顺序稳定
  const enabledTags = Object.entries(config.tagRules.tags)
    .filter(([, tagConfig]) => tagConfig.enabled)
    .map(([key, tagConfig]) => ({
      key: key as DashboardTagKeyType,
      ...tagConfig
    }))
    .sort((a, b) => a.priority - b.priority)

  const sectionsByGroup = enabledTags.reduce<
    Record<DashboardFocusGroupKeyType, DashboardFocusSectionType[]>
  >(
    (result, tag) => {
      // 以区块 key 分组收集命中该标签的学生；波动标签会按走势方向拆成两个区块（见 getSectionMeta）
      const sectionMap = new Map<
        DashboardFocusSectionKeyType,
        {
          label: string
          description: string
          entries: Array<{ item: DashboardStudentListItemType; tagSortScore: number }>
        }
      >()

      metrics
        .filter((metric) => metric.matchedTags.some((matchedTag) => matchedTag.key === tag.key))
        .forEach((metric) => {
          const item = toStudentListItem(metric, tag.key)
          if (!item) return

          const sectionMeta =
            tag.key === 'volatility'
              ? getSectionMeta(tag.key, metric)
              : {
                  key: tag.key,
                  label: tag.label,
                  description: tag.description
                }
          const currentSection = sectionMap.get(sectionMeta.key) || {
            label: sectionMeta.label,
            description: sectionMeta.description,
            entries: []
          }

          currentSection.entries.push({
            item,
            // 附带该学生在此标签下的排序分数，供下方统一排序
            tagSortScore: getTagSortScore(metric, tag.key, config)
          })
          sectionMap.set(sectionMeta.key, currentSection)
        })

      sectionMap.forEach((section, sectionKey) => {
        const items = section.entries
          // 排序优先级：标签排序分降序 → 该标签是主标签者靠前 → 主标签 priority 升序 → 姓名拼音
          .sort((a, b) => {
            if (a.tagSortScore !== b.tagSortScore) {
              return b.tagSortScore - a.tagSortScore
            }

            if (a.item.primaryTag.key === tag.key && b.item.primaryTag.key !== tag.key) {
              return -1
            }

            if (a.item.primaryTag.key !== tag.key && b.item.primaryTag.key === tag.key) {
              return 1
            }

            if (a.item.primaryTag.priority !== b.item.primaryTag.priority) {
              return a.item.primaryTag.priority - b.item.primaryTag.priority
            }

            return a.item.name.localeCompare(b.item.name, 'zh-CN')
          })
          .map((entry) => entry.item)

        result[tag.group].push({
          key: sectionKey,
          label: section.label,
          description: section.description,
          // 区块排序以标签 priority 为主，展示层不再自行写死“立即关注”等分组顺序。
          // 这样后续只需要调整 dashboard 常量里的 priority，就能统一影响卡片、标签和区块顺序。
          priority: tag.priority,
          count: items.length,
          items
        })
      })

      return result
    },
    {
      attention: [],
      encouragement: [],
      middleChange: [],
      volatilityWatch: []
    }
  )

  return (Object.keys(tagGroups) as DashboardFocusGroupKeyType[]).map((groupKey) => ({
    key: groupKey,
    label: tagGroups[groupKey].label,
    tone: tagGroups[groupKey].tone,
    sections: sectionsByGroup[groupKey].filter((section) => section.items.length > 0)
  }))
}

/**
 * 生成关键学生列表（用于概览页左侧下方的学生列表展示）。
 *
 * 从三个分组（attention/encouragement/volatilityWatch）中各取最多 N 名学生。
 * 选取规则：按推荐分数排序，推荐分数相同则按标签优先级排序。
 * 波动观察组内再按中段变化类型细分排序。
 *
 * @param metrics 学生画像列表
 * @param config 总览页配置
 * @returns 关键学生名单列表
 */
export const buildKeyStudentLists = (
  metrics: StudentMetricType[],
  config: OverviewDashboardConfigType
): DashboardKeyStudentListType[] => {
  const labels: Record<DashboardFocusGroupKeyType, { label: string }> = {
    attention: {
      label: '需要马上关注'
    },
    encouragement: {
      label: '最近值得鼓励'
    },
    middleChange: {
      label: '波动观察'
    },
    volatilityWatch: {
      label: '波动观察'
    }
  }

  // 波动观察组内按中段变化展示顺序排序（下滑关注 → 回升关注 → 波动下行 → 波动上行 → …）
  const middleChangeOrder: Record<DashboardFocusSectionKeyType, number> = {
    middleFalling: 0,
    middleRising: 1,
    volatilityFalling: 2,
    volatilityRising: 3,
    volatility: 4,
    critical: 5,
    persistentLowScore: 6,
    declining: 7,
    abnormal: 8,
    improving: 9,
    lowRecovery: 10,
    stableTop: 11
  }

  return (['attention', 'encouragement', 'volatilityWatch'] as DashboardFocusGroupKeyType[]).map(
    (groupKey) => ({
      key: groupKey,
      label: labels[groupKey].label,
      items: metrics
        .filter((metric) => metric.matchedTags.some((tag) => tag.group === groupKey))
        .map((metric) => ({
          metric,
          item: toStudentListItem(metric),
          recommendScore: getRecommendScore(metric, groupKey, config)
        }))
        .filter(
          (
            entry
          ): entry is {
            metric: StudentMetricType
            item: DashboardStudentListItemType
            recommendScore: number
          } => entry.item !== null
        )
        .sort((a, b) => {
          // 排序优先级：推荐分降序 → 波动组的区块顺序 → 主标签 priority 升序 → 姓名拼音
          if (a.recommendScore !== b.recommendScore) {
            return b.recommendScore - a.recommendScore
          }

          if (groupKey === 'volatilityWatch') {
            const sectionOrderDiff =
              middleChangeOrder[getMiddleChangeDisplayKey(a.metric)] -
              middleChangeOrder[getMiddleChangeDisplayKey(b.metric)]

            if (sectionOrderDiff !== 0) {
              return sectionOrderDiff
            }
          }

          if (a.item.primaryTag.priority !== b.item.primaryTag.priority) {
            return a.item.primaryTag.priority - b.item.primaryTag.priority
          }

          return a.item.name.localeCompare(b.item.name, 'zh-CN')
        })
        .slice(0, config.recommendation.maxItemsPerGroup)
        .map((entry) => entry.item)
    })
  )
}
