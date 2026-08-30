/** IndexedDB 数据库名称 */
export const DATABASE_NAME = 'score-recording-system'
/** 所有 Store 持久化记录的统一主键 */
export const DATABASE_MAIN_RECORD_ID = 'main'

/** 数据库表名枚举，与 Dexie 建表定义一一对应 */
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
  SeatingCharts = 'seating_charts',
  DutyRosters = 'duty_rosters'
}
