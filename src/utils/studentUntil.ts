import type { TagCategoryType } from '@/types/Setting'

export interface StudentWithTags {
  tags?: Record<string, string[] | undefined>
}

export function extractStudentTags(
  item: StudentWithTags,
  tagCategoryList: TagCategoryType[]
): string[] {
  const allTags: string[] = []
  for (const cat of tagCategoryList) {
    const tagList = item.tags?.[cat.prop]
    if (tagList && tagList.length > 0) {
      allTags.push(...tagList)
    }
  }
  return allTags
}
