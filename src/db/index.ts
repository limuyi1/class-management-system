import Dexie, { type Table } from 'dexie'

export interface DataSourceRecord {
  id: string
  data: any[]
}

export interface WrongBookRecord {
  id: string
  folders: any[]
  questions: any[]
  selectedFolderId: string
  questionTypes: any[]
}

export interface SettingRecord {
  id: string
  tableHeaders: any[]
  tagCategory: any[]
  tags: any
}

export interface ConfigurationRecord {
  id: string
  data: any
}

export interface ThemeRecord {
  id: string
  currentTheme: string
}

export interface AIConfigRecord {
  id: string
  modelType: string
  model: string
  apiKey: string
  baseUrl: string
  prompts: any
  availableModels: string[]
}

export class SCSDatabase extends Dexie {
  dataSource!: Table<DataSourceRecord>
  wrongBook!: Table<WrongBookRecord>
  setting!: Table<SettingRecord>
  configuration!: Table<ConfigurationRecord>
  theme!: Table<ThemeRecord>
  aiConfig!: Table<AIConfigRecord>

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
  }
}

export const db = new SCSDatabase()

export const DB_ID = 'main'
