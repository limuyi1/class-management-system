import { defineStore } from 'pinia'

import { PagesEnum } from '@/types/Common'
import type { ToolsStateType } from '@/types/Tools'

/**
 * 工具模块配置
 * 后续新增工具时，将对应参数集中保存在该 store，并由 Dexie 持久化。
 */
export const useToolsStore = defineStore('tools', {
  state: (): ToolsStateType => ({
    paperLayout: {
      pageType: PagesEnum.A4,
      orientation: 'landscape',
      columns: 2,
      margin: 10,
      gap: 6
    }
  })
})
