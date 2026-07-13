export const DATABASE_NAME = 'score-recording-system'
export const DATABASE_MAIN_RECORD_ID = 'main'

export enum DatabaseTableEnum {
  StudentDataset = 'student_dataset',
  ScoreSettings = 'score_settings',
  AppPreferences = 'app_preferences',
  ThemePreferences = 'theme_preferences',
  AISettings = 'ai_settings',
  WrongBook = 'wrong_book',
  OverviewAnalysisCache = 'overview_analysis_cache',
  ToolPreferences = 'tool_preferences',
  ScoreNotice = 'score_notice',
  Attachments = 'attachments',
  PaperLayoutDrafts = 'paper_layout_drafts',
  SeatingCharts = 'seating_charts'
}
