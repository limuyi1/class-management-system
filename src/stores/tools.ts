import { defineStore } from 'pinia'

import type { ToolsStateType } from '@/types/Tools'
import { createDefaultPaperLayoutSettings } from '@/views/tools/constants/paperLayout'

/**
 * 工具模块配置
 * 后续新增工具时，将对应参数集中保存在该 store，并由 Dexie 持久化。
 */
export const useToolsStore = defineStore('tools', {
  state: (): ToolsStateType => ({
    paperLayout: createDefaultPaperLayoutSettings()
  })
})
