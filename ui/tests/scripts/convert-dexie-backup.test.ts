/**
 * convert-dexie-backup 迁移脚本测试
 * 覆盖：备份格式校验、dataSource→student_dataset 的字段迁移（data→students、xing4_ming2→name）、
 * setting→score_settings 的旧字段兼容（tableHeaders/tagCategory）、默认分支的元数据清理与
 * updatedAt 补充、附件表原样保留、未知表跳过、键值对行格式兼容、tables 元信息生成。
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { convertBackup } from '../../../scripts/convert-dexie-backup.mjs'

// 构造最小化的旧版 Dexie v1 导出备份结构
const createBackup = (chunks: unknown[]) => ({
  formatName: 'dexie',
  formatVersion: 1,
  data: {
    databaseName: 'scs-database',
    databaseVersion: 1,
    tables: [],
    data: chunks
  }
})

/** 构造一个旧版 dataSource 分块 */
const createLegacyDataSourceChunk = (record: Record<string, unknown>) => ({
  tableName: 'dataSource',
  inbound: true,
  rows: [record]
})

describe('convert-dexie-backup', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-07T08:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('rejects backups that are not dexie v1 exports', () => {
    expect(() => convertBackup({ formatName: 'other', formatVersion: 1, data: {} })).toThrow(
      'Input file is not a dexie-export-import v1 backup'
    )
    expect(() => convertBackup({ formatName: 'dexie', formatVersion: 2, data: {} })).toThrow(
      'Input file is not a dexie-export-import v1 backup'
    )
    expect(() => convertBackup({ formatName: 'dexie', formatVersion: 1 })).toThrow(
      'Input file is not a dexie-export-import v1 backup'
    )
  })

  it('migrates legacy dataSource records into the student_dataset table', () => {
    const backup = createBackup([
      createLegacyDataSourceChunk({
        id: 'main',
        data: [
          { studentId: 's1', xing4_ming2: '张三', unit1: 88 },
          { studentId: 's2', name: '李四', unit1: 76 }
        ],
        updatedAt: '2026-01-01T00:00:00.000Z'
      })
    ])

    const converted = convertBackup(backup)

    expect(converted.formatName).toBe('dexie')
    expect(converted.formatVersion).toBe(1)
    expect(converted.data.databaseName).toBe('score-recording-system')
    expect(converted.data.databaseVersion).toBe(1)
    const studentChunk = converted.data.data.find(
      (chunk: { tableName: string }) => chunk.tableName === 'student_dataset'
    )
    expect(studentChunk).toBeDefined()
    expect(studentChunk.rows[0].id).toBe('main')
    expect(studentChunk.rows[0].students).toEqual([
      { studentId: 's1', name: '张三', unit1: 88 },
      { studentId: 's2', name: '李四', unit1: 76 }
    ])
    // 已有字符串 updatedAt 时保留原值
    expect(studentChunk.rows[0].updatedAt).toBe('2026-01-01T00:00:00.000Z')
  })

  it('normalizes existing student_dataset records and keeps the name field', () => {
    const backup = createBackup([
      {
        tableName: 'student_dataset',
        inbound: true,
        rows: [
          {
            id: 'main',
            students: [{ studentId: 's1', xing4_ming2: '王五', name: '新姓名' }]
          }
        ]
      }
    ])

    const converted = convertBackup(backup)
    const chunk = converted.data.data.find(
      (item: { tableName: string }) => item.tableName === 'student_dataset'
    )

    // name 字段优先，不被旧字段覆盖
    expect(chunk.rows[0].students[0].name).toBe('新姓名')
    expect(chunk.rows[0].students[0].xing4_ming2).toBeUndefined()
    expect(chunk.rows[0].updatedAt).toBe('2026-09-07T08:00:00.000Z')
  })

  it('migrates legacy setting records with tableHeaders and tagCategory', () => {
    const backup = createBackup([
      {
        tableName: 'setting',
        inbound: true,
        rows: [
          {
            id: 'main',
            tableHeaders: [
              { prop: 'xing4_ming2', label: '姓名' },
              { prop: 'unit1', label: '第一单元' }
            ],
            tagCategory: [{ prop: 'xue2_xi2', label: '学习习惯' }],
            updatedAt: '2026-01-01T00:00:00.000Z'
          }
        ]
      }
    ])

    const converted = convertBackup(backup)
    const chunk = converted.data.data.find(
      (item: { tableName: string }) => item.tableName === 'score_settings'
    )

    expect(chunk.rows[0].scoreColumns).toEqual([
      { prop: 'name', label: '姓名' },
      { prop: 'unit1', label: '第一单元' }
    ])
    expect(chunk.rows[0].tagCategories).toEqual([{ prop: 'xue2_xi2', label: '学习习惯' }])
    expect(chunk.rows[0].tableHeaders).toBeUndefined()
    expect(chunk.rows[0].tagCategory).toBeUndefined()
  })

  it('strips Dexie type metadata and regenerates updatedAt for unknown tables', () => {
    const backup = createBackup([
      {
        tableName: 'theme',
        inbound: true,
        rows: [
          {
            id: 'main',
            currentTheme: 'bluepink',
            updatedAt: '2026-01-01T00:00:00.000Z',
            $types: { currentTheme: 'string' }
          }
        ]
      }
    ])

    const converted = convertBackup(backup)
    const chunk = converted.data.data.find(
      (item: { tableName: string }) => item.tableName === 'theme_preferences'
    )

    expect(chunk.rows[0].currentTheme).toBe('bluepink')
    expect(chunk.rows[0].$types).toBeUndefined()
    // 默认分支统一重新生成 updatedAt
    expect(chunk.rows[0].updatedAt).toBe('2026-09-07T08:00:00.000Z')
  })

  it('keeps attachments and paper layout drafts unchanged', () => {
    const attachmentRecord = { id: 'a1', name: '图.png', blob: 'blob-data', sortOrder: 0 }
    const backup = createBackup([
      { tableName: 'attachments', inbound: true, rows: [attachmentRecord] },
      {
        tableName: 'paper_layout_drafts',
        inbound: true,
        rows: [{ id: 'd1', name: '草稿', settings: { pageType: 'A4' } }]
      }
    ])

    const converted = convertBackup(backup)

    const attachmentChunk = converted.data.data.find(
      (item: { tableName: string }) => item.tableName === 'attachments'
    )
    expect(attachmentChunk.rows[0]).toEqual(attachmentRecord)
    const draftChunk = converted.data.data.find(
      (item: { tableName: string }) => item.tableName === 'paper_layout_drafts'
    )
    expect(draftChunk.rows[0].name).toBe('草稿')
  })

  it('skips chunks with unknown table names', () => {
    const backup = createBackup([
      { tableName: 'unknownTable', inbound: true, rows: [{ id: 'x' }] }
    ])

    const converted = convertBackup(backup)

    expect(converted.data.data).toHaveLength(0)
  })

  it('supports key-value row format and skips non-record rows', () => {
    const backup = createBackup([
      {
        tableName: 'theme',
        inbound: true,
        rows: [
          ['main', { currentTheme: 'green' }],
          'not-a-record',
          ['other', 123]
        ]
      }
    ])

    const converted = convertBackup(backup)
    const chunk = converted.data.data.find(
      (item: { tableName: string }) => item.tableName === 'theme_preferences'
    )

    expect(chunk.rows).toHaveLength(1)
    expect(chunk.rows[0][0]).toBe('main')
    expect(chunk.rows[0][1].currentTheme).toBe('green')
  })

  it('generates table metadata with schemas and row counts', () => {
    const backup = createBackup([
      createLegacyDataSourceChunk({
        id: 'main',
        data: [{ studentId: 's1', xing4_ming2: '张三' }],
        updatedAt: '2026-01-01T00:00:00.000Z'
      })
    ])

    const converted = convertBackup(backup)

    expect(converted.data.tables).toHaveLength(10)
    const studentTable = converted.data.tables.find(
      (table: { name: string }) => table.name === 'student_dataset'
    )
    expect(studentTable.schema).toBe('id, updatedAt')
    expect(studentTable.rowCount).toBe(1)
    const attachmentTable = converted.data.tables.find(
      (table: { name: string }) => table.name === 'attachments'
    )
    expect(attachmentTable.schema).toBe('id, sortOrder, name, createdAt, updatedAt')
    expect(attachmentTable.rowCount).toBe(0)
  })

  it('merges chunks that map to the same target table', () => {
    const backup = createBackup([
      createLegacyDataSourceChunk({
        id: 'main',
        data: [{ studentId: 's1', xing4_ming2: '张三' }]
      }),
      {
        tableName: 'student_dataset',
        inbound: true,
        rows: [
          {
            id: 'extra',
            students: [{ studentId: 's2', name: '李四' }],
            updatedAt: '2026-01-02T00:00:00.000Z'
          }
        ]
      }
    ])

    const converted = convertBackup(backup)
    const chunks = converted.data.data.filter(
      (item: { tableName: string }) => item.tableName === 'student_dataset'
    )

    expect(chunks).toHaveLength(1)
    expect(chunks[0].rows).toHaveLength(2)
  })
})
