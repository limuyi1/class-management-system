import { defineStore } from 'pinia'

import type { ToolsStateType } from '@/types/Tools'
import { createDefaultPaperLayoutSettings } from '@/views/tools/constants/paperLayout'

/**
 * 工具模块配置
 * 后续新增工具时，将对应参数集中保存在该 store，并由 Dexie 持久化。
 */
export const useToolsStore = defineStore('tools', {
  state: (): ToolsStateType => ({
    /** 纸张布局设置 */
    paperLayout: createDefaultPaperLayoutSettings(),
    /** 各班级共用模板，由全局持久化插件写入 tools 记录 */
    cardTemplates: []
  })
})
