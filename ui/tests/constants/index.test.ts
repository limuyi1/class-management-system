/**
 * 全局常量测试
 * 覆盖：学生字段 prop 键（姓名/学生ID）作为唯一事实来源、数据库名称与主记录 ID、
 * 数据库表枚举到持久化表名的映射。
 */

import { describe, expect, it } from 'vitest'

import {
  DATABASE_MAIN_RECORD_ID,
  DATABASE_NAME,
  DatabaseTableEnum,
  NAME_LABEL,
  NAME_PROP,
  STUDENT_ID_LABEL,
  STUDENT_ID_PROP
} from '@/constants'

// 目标：保证常量与 Dexie schema、学生字段命名保持一致，防止各处硬编码漂移
describe('constants', () => {
  it('keeps student field prop keys as the single source of truth', () => {
    expect(NAME_PROP).toBe('name')
    expect(STUDENT_ID_PROP).toBe('studentId')
    expect(NAME_LABEL).toBe('姓名')
    expect(STUDENT_ID_LABEL).toBe('学生ID')
  })

  it('keeps database identifiers aligned with the Dexie schema', () => {
    expect(DATABASE_NAME).toBe('score-recording-system')
    expect(DATABASE_MAIN_RECORD_ID).toBe('main')
  })

  it('maps every table enum member to its persisted table name', () => {
    expect(DatabaseTableEnum.StudentDataset).toBe('student_dataset')
    expect(DatabaseTableEnum.ScoreSettings).toBe('score_settings')
    expect(DatabaseTableEnum.AppPreferences).toBe('app_preferences')
    expect(DatabaseTableEnum.ThemePreferences).toBe('theme_preferences')
    expect(DatabaseTableEnum.AISettings).toBe('ai_settings')
    expect(DatabaseTableEnum.WrongBook).toBe('wrong_book')
    expect(DatabaseTableEnum.OverviewAnalysisCache).toBe('overview_analysis_cache')
    expect(DatabaseTableEnum.ToolPreferences).toBe('tool_preferences')
    expect(DatabaseTableEnum.ScoreNotice).toBe('score_notice')
    expect(DatabaseTableEnum.Attachments).toBe('attachments')
    expect(DatabaseTableEnum.PaperLayoutDrafts).toBe('paper_layout_drafts')
    expect(DatabaseTableEnum.SeatingCharts).toBe('seating_charts')
    expect(DatabaseTableEnum.DutyRosters).toBe('duty_rosters')
  })
})
