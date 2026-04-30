import Dexie, { type Table } from 'dexie'

import type {
  AIConfigRecord,
  AttachmentRecord,
  ConfigurationRecord,
  DataSourceRecord,
  OverviewAnalysisRecord,
  PaperLayoutDraftRecord,
  SettingRecord,
  ThemeRecord,
  TeacherScheduleRecord,
  ToolsRecord,
  WrongBookRecord
} from '@/types/Database'

export class SCSDatabase extends Dexie {
  dataSource!: Table<DataSourceRecord>
  wrongBook!: Table<WrongBookRecord>
  setting!: Table<SettingRecord>
  configuration!: Table<ConfigurationRecord>
  theme!: Table<ThemeRecord>
  aiConfig!: Table<AIConfigRecord>
  overviewAnalysis!: Table<OverviewAnalysisRecord>
  tools!: Table<ToolsRecord>
  teacherSchedule!: Table<TeacherScheduleRecord>
  attachments!: Table<AttachmentRecord>
  paperLayoutDrafts!: Table<PaperLayoutDraftRecord>

  constructor() {
    super('scs-database')
    this.version(1).stores({
      dataSource: 'id',
      wrongBook: 'id',
      setting: 'id',
      configuration: 'id',
      theme: 'id',
      aiConfig: 'id'
    })
    this.version(2).stores({
      dataSource: 'id',
      wrongBook: 'id',
      setting: 'id',
      configuration: 'id',
      theme: 'id',
      aiConfig: 'id',
      overviewAnalysis: 'id'
    })
    this.version(3).stores({
      dataSource: 'id',
      wrongBook: 'id',
      setting: 'id',
      configuration: 'id',
      theme: 'id',
      aiConfig: 'id',
      overviewAnalysis: 'id',
      tools: 'id'
    })
    this.version(4).stores({
      dataSource: 'id',
      wrongBook: 'id',
      setting: 'id',
      configuration: 'id',
      theme: 'id',
      aiConfig: 'id',
      overviewAnalysis: 'id',
      tools: 'id',
      attachments: 'id, name, createdAt, updatedAt',
      paperLayoutDrafts: 'id, name, createdAt, updatedAt'
    })
    this.version(5).stores({
      dataSource: 'id',
      wrongBook: 'id',
      setting: 'id',
      configuration: 'id',
      theme: 'id',
      aiConfig: 'id',
      overviewAnalysis: 'id',
      tools: 'id',
      attachments: 'id, sortOrder, name, createdAt, updatedAt',
      paperLayoutDrafts: 'id, name, createdAt, updatedAt'
    }).upgrade(async (tx) => {
      const attachmentTable = tx.table('attachments')
      const records = await attachmentTable.orderBy('createdAt').reverse().toArray()
      await attachmentTable.bulkPut(
        records.map((record, index) => ({
          ...record,
          sortOrder: index
        }))
      )
    })
    this.version(6).stores({
      dataSource: 'id',
      wrongBook: 'id',
      setting: 'id',
      configuration: 'id',
      theme: 'id',
      aiConfig: 'id',
      overviewAnalysis: 'id',
      tools: 'id',
      teacherSchedule: 'id',
      attachments: 'id, sortOrder, name, createdAt, updatedAt',
      paperLayoutDrafts: 'id, name, createdAt, updatedAt'
    })
  }
}

export const db = new SCSDatabase()

export const DB_ID = 'main'

export type {
  AIConfigRecord,
  AttachmentRecord,
  ConfigurationRecord,
  DataSourceRecord,
  OverviewAnalysisRecord,
  PaperLayoutDraftRecord,
  SettingRecord,
  ThemeRecord,
  TeacherScheduleRecord,
  ToolsRecord,
  WrongBookRecord
}
