import { defineStore } from 'pinia'

import { createDefaultTagCategories, createDefaultTags } from '@/config/defaultTags'
import { NAME_PROP } from '@/constants'

import type { SettingType } from '@/types/Setting'

/**
 * 设置状态管理
 * 负责管理成绩列配置、学生标签分类和标签映射
 */
export const useSettingStore = defineStore('setting', {
  state: () => ({
    /**
     * 成绩列配置列表
     * 每个元素包含 prop（属性名）和 label（显示名称）
     * 首列固定为姓名列，不可删除
     */
    scoreColumns: [] as Array<SettingType>,
    /**
     * 标签分类列表
     * 用于对学生进行分组标记，如"优点"、"缺点"、"学习情况"等
     * 每个分类有 prop（唯一标识）和 label（显示名称）
     */
    tagCategories: createDefaultTagCategories(),
    /**
     * 标签映射表
     * 键为分类属性名（tagCategories.prop），值为该分类下的标签数组
     * 结构示例：{ '优点': ['认真', '积极'], '缺点': ['迟到'] }
     */
    tags: createDefaultTags()
  }),
  getters: {
    /**
     * 已启用的成绩列
     * 过滤掉姓名列和已禁用列
     */
    enabledScoreColumns: (state) =>
      state.scoreColumns.filter((item) => item.prop !== NAME_PROP && !item.disabled)
  },
  actions: {}
})
