import { defineStore } from 'pinia'

import { PagesEnum } from '@/types/Common'
import type { ConfigurationType } from '@/types/Configuration'

/**
 * 应用配置状态管理
 * 负责存储应用设置，包括字体大小、纸张类型、当前录入分数标签页等
 */
export const useConfigurationStore = defineStore('configuration', {
  state: (): ConfigurationType => {
    return {
      fontSize: 18,
      salutationFontSize: 18,
      textFontSize: 18,
      sealFontSize: 18,
      classTeacherFontSize: 18,
      inscribeFontSize: 18,
      inscribe: '',
      showEvaluationPageNumber: true,
      pageType: PagesEnum.A4,
      pageTypeList: [PagesEnum.A3, PagesEnum.A4, PagesEnum.B3, PagesEnum.B4],
      evaluationCardWidth: 90,
      evaluationCardHeight: 69,
      marginX: 15,
      marginY: 7.5,
      evaluationTableAlign: 'left',
      previewMode: '100',
      inputScoreTab: null,
      recentScoreEntries: {},
      scoreImageCompressRatio: 0.6,
      evaluationHandwriteFont: null
    }
  },
  actions: {
    /**
     * 同步更新所有字体大小设置
     * 用于批量调整评语模板中的各类字体大小
     * @param fontSize - 新的字体大小值
     */
    fontSizeChange(fontSize: number) {
      this.salutationFontSize = fontSize
      this.textFontSize = fontSize
      this.sealFontSize = fontSize
      this.classTeacherFontSize = fontSize
      this.inscribeFontSize = fontSize
    }
  }
})
