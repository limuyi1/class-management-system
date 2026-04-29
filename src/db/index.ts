import Dexie, { type Table } from 'dexie'

import type {
  AIConfigRecord,
  ConfigurationRecord,
  DataSourceRecord,
  OverviewAnalysisRecord,
  SettingRecord,
  ThemeRecord,
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
  }
}

export const db = new SCSDatabase()

export const DB_ID = 'main'

export type {
  AIConfigRecord,
  ConfigurationRecord,
  DataSourceRecord,
  OverviewAnalysisRecord,
  SettingRecord,
  ThemeRecord,
  ToolsRecord,
  WrongBookRecord
}
