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
      /** 系统字体大小 */
      fontSize: 18,
      /** 评语称呼字体大小 */
      salutationFontSize: 18,
      /** 评语正文字体大小 */
      textFontSize: 18,
      /** 印章字体大小 */
      sealFontSize: 18,
      /** 班主任签名字体大小 */
      classTeacherFontSize: 18,
      /** 落款字体大小 */
      inscribeFontSize: 18,
      /** 落款文本 */
      inscribe: '',
      /** 是否显示评语页码 */
      showEvaluationPageNumber: true,
      /** 当前选择的纸张类型 */
      pageType: PagesEnum.A4,
      /** 可选纸张类型列表 */
      pageTypeList: [PagesEnum.A3, PagesEnum.A4, PagesEnum.B3, PagesEnum.B4],
      /** 评语卡片宽度 */
      evaluationCardWidth: 90,
      /** 评语卡片高度 */
      evaluationCardHeight: 69,
      /** 页边距 X */
      marginX: 15,
      /** 页边距 Y */
      marginY: 7.5,
      /** 评语表格对齐方式 */
      evaluationTableAlign: 'left',
      /** 预览缩放模式 */
      previewMode: '100',
      /** 当前正在录入的成绩列 prop（null 表示未选择） */
      inputScoreTab: null,
      /** 最近成绩录入记录，key 为成绩列 prop */
      recentScoreEntries: {},
      /** 成绩图片识别压缩比例 */
      scoreImageCompressRatio: 0.6,
      /** 评语手写字体（null 表示未配置） */
      evaluationHandwriteFont: null,
      /** 上次数据备份时间（null 表示从未备份） */
      lastBackupAt: null,
      /** 成绩满分（用于录入边界校验） */
      scoreFullMark: 100,
      /** 左侧导航菜单是否折叠 */
      menuCollapsed: false
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
