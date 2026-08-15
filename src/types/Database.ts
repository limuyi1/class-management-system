import type { StudentDataType } from './StudentData'
import type { WrongFolder, WrongQuestion } from './WrongBook'
import type { SettingType, TagCategoryType, TagType } from './Setting'
import type { EvaluationHandwriteFontType } from './Configuration'
import type {
  AttachmentRecordType,
  PaperLayoutDraftRecordType,
  PaperLayoutSettingsType
} from './Tools'
import type { ScoreNoticeStateType } from './ScoreNotice'
import type { SeatingChartStateType } from './SeatingChart'
import type { DutyRosterStateType } from './DutyRoster'

/**
 * 数据库记录类型定义
 * 每个接口对应 IndexedDB（Dexie）中一张表的一条记录，均以 id + updatedAt 为基本字段
 */

/** 学生数据集持久化记录 */
export interface StudentDatasetRecord {
  /** 记录唯一标识 */
  id: string
  /** 学生数据列表 */
  students: StudentDataType[]
  /** 更新时间（ISO 格式） */
  updatedAt: string
}

/** 错题本内存记录（不含 updatedAt） */
export interface WrongBookRecord {
  /** 记录唯一标识 */
  id: string
  /** 文件夹列表 */
  folders: WrongFolder[]
  /** 题目列表 */
  questions: WrongQuestion[]
  /** 当前选中的文件夹 ID */
  selectedFolderId: string
  /** 题目类型选项 */
  questionTypes: Array<{ value: string; label: string }>
}

/** 错题本持久化记录 */
export interface WrongBookStorageRecord extends WrongBookRecord {
  /** 更新时间（ISO 格式） */
  updatedAt: string
}

/** 成绩表格设置持久化记录 */
export interface ScoreSettingsRecord {
  /** 记录唯一标识 */
  id: string
  /** 成绩列配置列表 */
  scoreColumns: SettingType[]
  /** 标签分类列表 */
  tagCategories: TagCategoryType[]
  /** 标签数据集合 */
  tags: TagType
  /** 更新时间（ISO 格式） */
  updatedAt: string
}

/** 应用配置内存记录（不含 updatedAt） */
export interface ConfigurationRecord {
  /** 记录唯一标识 */
  id: string
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
  /** 当前选择的纸张类型 */
  pageType: string
  /** 可选纸张类型列表 */
  pageTypeList: string[]
  /** 当前正在录入的成绩列 prop（null 表示未选择） */
  inputScoreTab: string | null
  /** 最近成绩录入记录，key 为成绩列 prop */
  recentScoreEntries: Record<
    string,
    Array<{ studentId: string; name: string; score: number; time: string }>
  >
  /** 成绩图片识别压缩比例 */
  scoreImageCompressRatio?: number | null
  /** 评语手写字体（null 表示未配置） */
  evaluationHandwriteFont?: EvaluationHandwriteFontType | null
}

/** 应用配置持久化记录 */
export interface AppPreferencesRecord extends ConfigurationRecord {
  /** 更新时间（ISO 格式） */
  updatedAt: string
}

/** 主题内存记录（不含 updatedAt） */
export interface ThemeRecord {
  /** 记录唯一标识 */
  id: string
  /** 当前主题名称 */
  currentTheme: string
}

/** 主题持久化记录 */
export interface ThemePreferencesRecord extends ThemeRecord {
  /** 更新时间（ISO 格式） */
  updatedAt: string
}

/** AI 配置内存记录（不含 updatedAt） */
export interface AIConfigRecord {
  /** 记录唯一标识 */
  id: string
  /** AI 模型提供商 */
  modelType: string
  /** 模型名称 */
  model: string
  /** API Key */
  apiKey: string
  /** API 基础 URL */
  baseUrl: string
  /** 各场景的 Prompt 配置 */
  prompts: Record<string, string>
  /** 可用模型列表 */
  availableModels: string[]
}

/** AI 配置持久化记录 */
export interface AISettingsRecord extends AIConfigRecord {
  /** 更新时间（ISO 格式） */
  updatedAt: string
}

/** 概览分析内存记录（不含 updatedAt） */
export interface OverviewAnalysisRecord {
  /** 记录唯一标识 */
  id: string
  /** 学情分析文本（Markdown 格式） */
  analysisText: string
  /** 生成时间（ISO 格式） */
  generatedAt: string
}

/** 概览分析缓存持久化记录 */
export interface OverviewAnalysisCacheRecord extends OverviewAnalysisRecord {
  /** 更新时间（ISO 格式） */
  updatedAt: string
}

/** 工具配置内存记录（不含 updatedAt） */
export interface ToolsRecord {
  /** 记录唯一标识 */
  id: string
  /** 版纸布局设置 */
  paperLayout: PaperLayoutSettingsType
}

/** 工具配置持久化记录 */
export interface ToolPreferencesRecord extends ToolsRecord {
  /** 更新时间（ISO 格式） */
  updatedAt: string
}

/** 成绩通知单持久化记录 */
export interface ScoreNoticeStorageRecord extends ScoreNoticeStateType {
  /** 记录唯一标识 */
  id: string
  /** 更新时间（ISO 格式） */
  updatedAt: string
}

/** 座位表持久化记录 */
export interface SeatingChartStorageRecord extends SeatingChartStateType {
  /** 记录唯一标识 */
  id: string
  /** 更新时间（ISO 格式） */
  updatedAt: string
}

/** 值日表持久化记录 */
export interface DutyRosterStorageRecord extends DutyRosterStateType {
  /** 记录唯一标识 */
  id: string
  /** 更新时间（ISO 格式） */
  updatedAt: string
}

/** 附件库记录类型别名 */
export type AttachmentRecord = AttachmentRecordType

/** 版纸草稿记录类型别名 */
export type PaperLayoutDraftRecord = PaperLayoutDraftRecordType
