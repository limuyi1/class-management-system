import { defineStore } from 'pinia'

import type { SettingType, TagCategoryType, TagType } from '@/types/Setting'

export const useSettingStore = defineStore('setting', {
  state: () => ({
    tableHeaders: [] as Array<SettingType>,
    tagCategory: [] as Array<TagCategoryType>,
    tags: {} as TagType
  }),
  actions: {},
  persist: true
})
