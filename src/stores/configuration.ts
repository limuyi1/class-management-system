import { defineStore } from 'pinia'

import { PagesEnum } from '@/types/Common'
import type { ConfigurationType } from '@/types/Configuration'

export const useConfigurationStore = defineStore('configuration', {
  state: () => {
    return {
      data: {
        fontSize: 18,
        salutationFontSize: 18,
        textFontSize: 18,
        sealFontSize: 18,
        classTeacherFontSize: 18,
        inscribeFontSize: 18,
        inscribe: '',
        pageType: PagesEnum.A4,
        pageTypeList: [PagesEnum.A3, PagesEnum.A4, PagesEnum.B3, PagesEnum.B4],
        inputScoreTab: null
      } as ConfigurationType
    }
  },
  actions: {
    fontSizeChange(fontSize: number) {
      this.data.salutationFontSize = fontSize // 问候语字号
      this.data.textFontSize = fontSize // 正文字号
      this.data.sealFontSize = fontSize // 印章字号
      this.data.classTeacherFontSize = fontSize // 班主任字号
      this.data.inscribeFontSize = fontSize // 落款字号
    }
  }
})
