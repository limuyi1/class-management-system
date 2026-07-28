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
  id: string
  students: StudentDataType[]
  updatedAt: string
}

/** 错题本内存记录（不含 updatedAt） */
export interface WrongBookRecord {
  id: string
  folders: WrongFolder[]
  questions: WrongQuestion[]
  selectedFolderId: string
  questionTypes: Array<{ value: string; label: string }>
}

/** 错题本持久化记录 */
export interface WrongBookStorageRecord extends WrongBookRecord {
  updatedAt: string
}

/** 成绩表格设置持久化记录 */
export interface ScoreSettingsRecord {
  id: string
  scoreColumns: SettingType[]
  tagCategories: TagCategoryType[]
  tags: TagType
  updatedAt: string
}

/** 应用配置内存记录（不含 updatedAt） */
export interface ConfigurationRecord {
  id: string
  fontSize: number
  salutationFontSize: number
  textFontSize: number
  sealFontSize: number
  classTeacherFontSize: number
  inscribeFontSize: number
  inscribe: string
  pageType: string
  pageTypeList: string[]
  inputScoreTab: string | null
  recentScoreEntries: Record<
    string,
    Array<{ studentId: string; name: string; score: number; time: string }>
  >
  scoreImageCompressRatio?: number | null
  evaluationHandwriteFont?: EvaluationHandwriteFontType | null
}

/** 应用配置持久化记录 */
export interface AppPreferencesRecord extends ConfigurationRecord {
  updatedAt: string
}

/** 主题内存记录（不含 updatedAt） */
export interface ThemeRecord {
  id: string
  currentTheme: string
}

/** 主题持久化记录 */
export interface ThemePreferencesRecord extends ThemeRecord {
  updatedAt: string
}

/** AI 配置内存记录（不含 updatedAt） */
export interface AIConfigRecord {
  id: string
  modelType: string
  model: string
  apiKey: string
  baseUrl: string
  prompts: Record<string, string>
  availableModels: string[]
}

/** AI 配置持久化记录 */
export interface AISettingsRecord extends AIConfigRecord {
  updatedAt: string
}

/** 概览分析内存记录（不含 updatedAt） */
export interface OverviewAnalysisRecord {
  id: string
  analysisText: string
  generatedAt: string
}

/** 概览分析缓存持久化记录 */
export interface OverviewAnalysisCacheRecord extends OverviewAnalysisRecord {
  updatedAt: string
}

/** 工具配置内存记录（不含 updatedAt） */
export interface ToolsRecord {
  id: string
  paperLayout: PaperLayoutSettingsType
}

/** 工具配置持久化记录 */
export interface ToolPreferencesRecord extends ToolsRecord {
  updatedAt: string
}

/** 成绩通知单持久化记录 */
export interface ScoreNoticeStorageRecord extends ScoreNoticeStateType {
  id: string
  updatedAt: string
}

/** 座位表持久化记录 */
export interface SeatingChartStorageRecord extends SeatingChartStateType {
  id: string
  updatedAt: string
}

/** 值日表持久化记录 */
export interface DutyRosterStorageRecord extends DutyRosterStateType {
  id: string
  updatedAt: string
}

export type AttachmentRecord = AttachmentRecordType

export type PaperLayoutDraftRecord = PaperLayoutDraftRecordType
