/**
 * 标签分类处理工具
 * 提供标签分类的拼音 prop 生成、唯一性校验等辅助功能
 */
import { pinyin } from 'pinyin-pro'

import type { TagCategoryType } from '@/types/Setting'

/**
 * 去除标签分类名称首尾空格。
 * @param label - 分类名称
 * @returns 去除首尾空格后的名称
 */
const normalizeCategoryLabel = (label: string): string => label.trim()

/**
 * 根据标签分类中文名称生成拼音 prop，生成失败时使用时间戳占位。
 * @param label - 分类名称
 * @returns 拼音拼接的 prop
 */
const createCategoryPropBase = (label: string): string => {
  const prop = pinyin(label, { toneType: 'num', type: 'array' })
    .map((item) => item.trim())
    .filter(Boolean)
    .join('_')

  return prop || `category_${Date.now()}`
}

/**
 * 判断标签分类名称是否已存在
 * @param categories - 已存在的标签分类列表
 * @param label - 待判断的分类名称
 * @returns 名称是否已存在
 */
export const hasCategoryLabel = (categories: TagCategoryType[], label: string): boolean => {
  const normalizedLabel = normalizeCategoryLabel(label)
  return categories.some((item) => item.label === normalizedLabel)
}

/**
 * 创建不重复的标签分类（prop 基于拼音，label 为原始输入）
 * @param label - 分类名称
 * @param categories - 已存在的标签分类列表
 * @returns 新创建的标签分类；名称为空或已存在时返回 null
 */
export const createUniqueTagCategory = (
  label: string,
  categories: TagCategoryType[]
): TagCategoryType | null => {
  const normalizedLabel = normalizeCategoryLabel(label)
  if (!normalizedLabel || hasCategoryLabel(categories, normalizedLabel)) {
    return null
  }

  const propBase = createCategoryPropBase(normalizedLabel)
  const existingProps = new Set(categories.map((item) => item.prop))
  let prop = propBase
  let index = 2

  // prop 冲突时追加数字后缀，直到不与已有分类重复
  while (existingProps.has(prop)) {
    prop = `${propBase}_${index}`
    index += 1
  }

  return {
    prop,
    label: normalizedLabel
  }
}

/**
 * 批量创建不重复的标签分类，逐个累加到已有列表保证互相之间也不重复。
 * @param labels - 待创建的标签分类名称列表
 * @param categories - 已存在的标签分类列表
 * @returns 成功创建的标签分类数组（跳过空名称与重复项）
 */
export const createUniqueTagCategories = (
  labels: string[],
  categories: TagCategoryType[]
): TagCategoryType[] => {
  const nextCategories = [...categories]
  const result: TagCategoryType[] = []

  labels.forEach((label) => {
    const category = createUniqueTagCategory(label, nextCategories)
    if (!category) return

    nextCategories.push(category)
    result.push(category)
  })

  return result
}
