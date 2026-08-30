/** 应用配置与评语打印相关的类型定义 */
import { PagesEnum } from '@/types/Common'

/** 预览缩放模式，支持自适应和固定比例 */
export type PreviewModeType = 'fit' | '50' | '75' | '100' | '125'
/** 评语表格水平对齐方式 */
export type EvaluationTableAlignType = 'left' | 'center' | 'right'

/** 最近一次录入的成绩记录，用于快速回填上次录入的分数 */
export interface RecentScoreEntryType {
  /** 学生唯一标识 */
  studentId: string
  /** 学生姓名 */
  name: string
  /** 录入的分数 */
  score: number
  /** 录入时间（ISO 格式） */
  time: string
}

/** 评语手写字体配置 */
export interface EvaluationHandwriteFontType {
  /** 字体名称 */
  name: string
  /** 字体文件 Base64 编码 */
  data: string
  /** 更新时间（ISO 格式） */
  updatedAt: string
}

/** 应用全局配置类型 */
export interface ConfigurationType {
  /** 系统字体大小 */
  fontSize: number
  /** 评语称呼字体大小 */
  salutationFontSize: number
  /** 评语正文字体大小 */
  textFontSize: number
  /** 印章字体大小 */
  sealFontSize: number
  /** 班主任签名字体大小 */
  classTeacherFontSize: number
  /** 落款字体大小 */
  inscribeFontSize: number
  /** 落款文本 */
  inscribe: string
  /** 是否显示评语页码 */
  showEvaluationPageNumber: boolean
  /** 当前选择的纸张类型 */
  pageType: PagesEnum
  /** 可选纸张类型列表 */
  pageTypeList: Array<PagesEnum>
  /** 评语卡片宽度 */
  evaluationCardWidth: number
  /** 评语卡片高度 */
  evaluationCardHeight: number
  /** 页边距 X */
  marginX: number
  /** 页边距 Y */
  marginY: number
  /** 评语表格对齐方式 */
  evaluationTableAlign: EvaluationTableAlignType
  /** 预览模式 */
  previewMode: PreviewModeType
  /** 当前正在录入的成绩列 prop（null 表示未选择） */
  inputScoreTab: string | null
  /** 最近成绩录入记录，key 为成绩列 prop */
  recentScoreEntries: Record<string, RecentScoreEntryType[]>
  /** 成绩图片识别压缩比例 */
  scoreImageCompressRatio: number | null
  /** 评语手写字体（null 表示未配置） */
  evaluationHandwriteFont: EvaluationHandwriteFontType | null
  /** 上次数据备份时间（ISO 格式，null 表示从未备份） */
  lastBackupAt: string | null
  /** 成绩满分（用于录入边界校验，默认 100） */
  scoreFullMark: number
  /** 左侧导航菜单是否折叠 */
  menuCollapsed: boolean
}
