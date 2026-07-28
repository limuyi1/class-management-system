/**
 * IndexedDB 数据库初始化
 * 使用 Dexie 管理版本化 schema，支持 4 个版本的渐进式迁移
 */
import Dexie, { type Table } from 'dexie'

import { DATABASE_MAIN_RECORD_ID, DATABASE_NAME, DatabaseTableEnum } from '@/db/constants'

import type {
  AISettingsRecord,
  AppPreferencesRecord,
  AttachmentRecord,
  OverviewAnalysisCacheRecord,
  PaperLayoutDraftRecord,
  ScoreSettingsRecord,
  ScoreNoticeStorageRecord,
  SeatingChartStorageRecord,
  DutyRosterStorageRecord,
  StudentDatasetRecord,
  ThemePreferencesRecord,
  ToolPreferencesRecord,
  WrongBookStorageRecord
} from '@/types/Database'

export class SCSDatabase extends Dexie {
  studentDataset!: Table<StudentDatasetRecord>
  scoreSettings!: Table<ScoreSettingsRecord>
  appPreferences!: Table<AppPreferencesRecord>
  themePreferences!: Table<ThemePreferencesRecord>
  aiSettings!: Table<AISettingsRecord>
  wrongBook!: Table<WrongBookStorageRecord>
  overviewAnalysisCache!: Table<OverviewAnalysisCacheRecord>
  toolPreferences!: Table<ToolPreferencesRecord>
  scoreNotice!: Table<ScoreNoticeStorageRecord>
  attachments!: Table<AttachmentRecord>
  paperLayoutDrafts!: Table<PaperLayoutDraftRecord>
  seatingCharts!: Table<SeatingChartStorageRecord>
  dutyRosters!: Table<DutyRosterStorageRecord>

  constructor() {
    super(DATABASE_NAME)
    this.version(1).stores({
      [DatabaseTableEnum.StudentDataset]: 'id, updatedAt',
      [DatabaseTableEnum.ScoreSettings]: 'id, updatedAt',
      [DatabaseTableEnum.AppPreferences]: 'id, updatedAt',
      [DatabaseTableEnum.ThemePreferences]: 'id, updatedAt',
      [DatabaseTableEnum.AISettings]: 'id, updatedAt',
      [DatabaseTableEnum.WrongBook]: 'id, updatedAt',
      [DatabaseTableEnum.OverviewAnalysisCache]: 'id, updatedAt',
      [DatabaseTableEnum.ToolPreferences]: 'id, updatedAt',
      [DatabaseTableEnum.Attachments]: 'id, sortOrder, name, createdAt, updatedAt',
      [DatabaseTableEnum.PaperLayoutDrafts]: 'id, name, createdAt, updatedAt'
    })

    this.version(2).stores({
      [DatabaseTableEnum.StudentDataset]: 'id, updatedAt',
      [DatabaseTableEnum.ScoreSettings]: 'id, updatedAt',
      [DatabaseTableEnum.AppPreferences]: 'id, updatedAt',
      [DatabaseTableEnum.ThemePreferences]: 'id, updatedAt',
      [DatabaseTableEnum.AISettings]: 'id, updatedAt',
      [DatabaseTableEnum.WrongBook]: 'id, updatedAt',
      [DatabaseTableEnum.OverviewAnalysisCache]: 'id, updatedAt',
      [DatabaseTableEnum.ToolPreferences]: 'id, updatedAt',
      [DatabaseTableEnum.ScoreNotice]: 'id, updatedAt',
      [DatabaseTableEnum.Attachments]: 'id, sortOrder, name, createdAt, updatedAt',
      [DatabaseTableEnum.PaperLayoutDrafts]: 'id, name, createdAt, updatedAt'
    })

    this.version(3).stores({
      [DatabaseTableEnum.StudentDataset]: 'id, updatedAt',
      [DatabaseTableEnum.ScoreSettings]: 'id, updatedAt',
      [DatabaseTableEnum.AppPreferences]: 'id, updatedAt',
      [DatabaseTableEnum.ThemePreferences]: 'id, updatedAt',
      [DatabaseTableEnum.AISettings]: 'id, updatedAt',
      [DatabaseTableEnum.WrongBook]: 'id, updatedAt',
      [DatabaseTableEnum.OverviewAnalysisCache]: 'id, updatedAt',
      [DatabaseTableEnum.ToolPreferences]: 'id, updatedAt',
      [DatabaseTableEnum.ScoreNotice]: 'id, updatedAt',
      [DatabaseTableEnum.Attachments]: 'id, sortOrder, name, createdAt, updatedAt',
      [DatabaseTableEnum.PaperLayoutDrafts]: 'id, name, createdAt, updatedAt',
      [DatabaseTableEnum.SeatingCharts]: 'id, updatedAt'
    })

    this.version(4).stores({
      [DatabaseTableEnum.StudentDataset]: 'id, updatedAt',
      [DatabaseTableEnum.ScoreSettings]: 'id, updatedAt',
      [DatabaseTableEnum.AppPreferences]: 'id, updatedAt',
      [DatabaseTableEnum.ThemePreferences]: 'id, updatedAt',
      [DatabaseTableEnum.AISettings]: 'id, updatedAt',
      [DatabaseTableEnum.WrongBook]: 'id, updatedAt',
      [DatabaseTableEnum.OverviewAnalysisCache]: 'id, updatedAt',
      [DatabaseTableEnum.ToolPreferences]: 'id, updatedAt',
      [DatabaseTableEnum.ScoreNotice]: 'id, updatedAt',
      [DatabaseTableEnum.Attachments]: 'id, sortOrder, name, createdAt, updatedAt',
      [DatabaseTableEnum.PaperLayoutDrafts]: 'id, name, createdAt, updatedAt',
      [DatabaseTableEnum.SeatingCharts]: 'id, updatedAt',
      [DatabaseTableEnum.DutyRosters]: 'id, updatedAt'
    })

    this.studentDataset = this.table(DatabaseTableEnum.StudentDataset)
    this.scoreSettings = this.table(DatabaseTableEnum.ScoreSettings)
    this.appPreferences = this.table(DatabaseTableEnum.AppPreferences)
    this.themePreferences = this.table(DatabaseTableEnum.ThemePreferences)
    this.aiSettings = this.table(DatabaseTableEnum.AISettings)
    this.wrongBook = this.table(DatabaseTableEnum.WrongBook)
    this.overviewAnalysisCache = this.table(DatabaseTableEnum.OverviewAnalysisCache)
    this.toolPreferences = this.table(DatabaseTableEnum.ToolPreferences)
    this.scoreNotice = this.table(DatabaseTableEnum.ScoreNotice)
    this.attachments = this.table(DatabaseTableEnum.Attachments)
    this.paperLayoutDrafts = this.table(DatabaseTableEnum.PaperLayoutDrafts)
    this.seatingCharts = this.table(DatabaseTableEnum.SeatingCharts)
    this.dutyRosters = this.table(DatabaseTableEnum.DutyRosters)
  }
}

export const db = new SCSDatabase()

export const DB_ID = DATABASE_MAIN_RECORD_ID

export type {
  AISettingsRecord,
  AppPreferencesRecord,
  AttachmentRecord,
  OverviewAnalysisCacheRecord,
  PaperLayoutDraftRecord,
  ScoreSettingsRecord,
  ScoreNoticeStorageRecord,
  SeatingChartStorageRecord,
  DutyRosterStorageRecord,
  StudentDatasetRecord,
  ThemePreferencesRecord,
  ToolPreferencesRecord,
  WrongBookStorageRecord
}
