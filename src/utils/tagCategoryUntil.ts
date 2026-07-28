/**
 * 标签分类处理工具
 * 提供标签分类的拼音 prop 生成、唯一性校验等辅助功能
 */
import { pinyin } from 'pinyin-pro'

import type { TagCategoryType } from '@/types/Setting'

const normalizeCategoryLabel = (label: string): string => label.trim()

/** 根据标签分类中文名称生成拼音 prop */
const createCategoryPropBase = (label: string): string => {
  const prop = pinyin(label, { toneType: 'num', type: 'array' })
    .map((item) => item.trim())
    .filter(Boolean)
    .join('_')

  return prop || `category_${Date.now()}`
}

/** 判断标签分类名称是否已存在 */
export const hasCategoryLabel = (categories: TagCategoryType[], label: string): boolean => {
  const normalizedLabel = normalizeCategoryLabel(label)
  return categories.some((item) => item.label === normalizedLabel)
}

/** 创建不重复的标签分类（prop 基于拼音，label 为原始输入） */
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

  while (existingProps.has(prop)) {
    prop = `${propBase}_${index}`
    index += 1
  }

  return {
    prop,
    label: normalizedLabel
  }
}

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
