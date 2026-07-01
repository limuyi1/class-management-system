export const LEGACY_DATABASE_NAME = 'scs-database'
export const DATABASE_NAME = 'score-recording-system'
export const DATABASE_MAIN_RECORD_ID = 'main'

export enum LegacyDatabaseTableEnum {
  DataSource = 'dataSource',
  WrongBook = 'wrongBook',
  Setting = 'setting',
  Configuration = 'configuration',
  Theme = 'theme',
  AIConfig = 'aiConfig',
  OverviewAnalysis = 'overviewAnalysis',
  Tools = 'tools',
  Attachments = 'attachments',
  PaperLayoutDrafts = 'paperLayoutDrafts'
}

export enum DatabaseTableEnum {
  StudentDataset = 'student_dataset',
  ScoreSettings = 'score_settings',
  AppPreferences = 'app_preferences',
  ThemePreferences = 'theme_preferences',
  AISettings = 'ai_settings',
  WrongBook = 'wrong_book',
  OverviewAnalysisCache = 'overview_analysis_cache',
  ToolPreferences = 'tool_preferences',
  Attachments = 'attachments',
  PaperLayoutDrafts = 'paper_layout_drafts'
}
