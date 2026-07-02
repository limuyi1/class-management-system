import { pinyin } from 'pinyin-pro'

import type { TagCategoryType } from '@/types/Setting'

const normalizeCategoryLabel = (label: string): string => label.trim()

const createCategoryPropBase = (label: string): string => {
  const prop = pinyin(label, { toneType: 'num', type: 'array' })
    .map((item) => item.trim())
    .filter(Boolean)
    .join('_')

  return prop || `category_${Date.now()}`
}

export const hasCategoryLabel = (categories: TagCategoryType[], label: string): boolean => {
  const normalizedLabel = normalizeCategoryLabel(label)
  return categories.some((item) => item.label === normalizedLabel)
}

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
