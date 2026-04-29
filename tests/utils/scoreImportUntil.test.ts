import { describe, expect, it } from 'vitest'

import {
  buildIncrementalScoreImport,
  buildInitialScoreImport,
  findDuplicateNames,
  getConflictLabels,
  parseScoreValue
} from '../../src/utils/scoreImportUntil'
import { NAME_PROP } from '../../src/types/Constants'
import type { SettingType } from '../../src/types/Setting'
import type { StudentDataType } from '../../src/types/StudentData'

describe('scoreImportUntil', () => {
  it('builds initial students from selected name and score columns', () => {
    const result = buildInitialScoreImport({
      rows: [
        { 学生: '张三', 数学: '96', 语文: 88 },
        { 学生: '李四', 数学: '', 语文: '优秀' }
      ],
      nameColumn: '学生',
      scoreColumns: ['数学', '语文']
    })

    expect(result.headers.map((header) => header.label)).toEqual(['数学', '语文'])
    expect(result.students).toHaveLength(2)
    expect(result.students[0][NAME_PROP]).toBe('张三')
    expect(result.students[0][result.headers[0].prop]).toBe(96)
    expect(result.students[1][result.headers[0].prop]).toBeNull()
    expect(result.students[1][result.headers[1].prop]).toBeNull()
    expect(result.invalidScoreCount).toBe(1)
  })

  it('adds new score columns for existing students by name', () => {
    const existingHeaders: SettingType[] = [{ prop: 'shu4_xue2', label: '数学' }]
    const existingStudents: StudentDataType[] = [
      { [NAME_PROP]: '张三', shu4_xue2: 90 },
      { [NAME_PROP]: '李四', shu4_xue2: 80 }
    ]

    const result = buildIncrementalScoreImport({
      rows: [
        { 姓名: '张三', 英语: '98' },
        { 姓名: '李四', 英语: 76 },
        { 姓名: '王五', 英语: 60 }
      ],
      existingStudents,
      existingHeaders,
      selectedColumns: ['英语'],
      conflictActions: {}
    })

    const englishHeader = result.headers.find((header) => header.label === '英语')

    expect(englishHeader).toBeTruthy()
    expect(result.stats.addedColumnCount).toBe(1)
    expect(result.stats.ignoredStudentCount).toBe(1)
    expect(result.students[0][englishHeader!.prop]).toBe(98)
    expect(result.students[1][englishHeader!.prop]).toBe(76)
  })

  it('overwrites existing score columns when conflict action is overwrite', () => {
    const existingHeaders: SettingType[] = [{ prop: 'shu4_xue2', label: '数学' }]
    const existingStudents: StudentDataType[] = [{ [NAME_PROP]: '张三', shu4_xue2: 90 }]

    const result = buildIncrementalScoreImport({
      rows: [{ 姓名: '张三', 数学: '99' }],
      existingStudents,
      existingHeaders,
      selectedColumns: ['数学'],
      conflictActions: { 数学: 'overwrite' }
    })

    expect(result.headers).toEqual(existingHeaders)
    expect(result.stats.overwrittenColumnCount).toBe(1)
    expect(result.students[0].shu4_xue2).toBe(99)
  })

  it('skips existing score columns when conflict action is skip', () => {
    const existingHeaders: SettingType[] = [{ prop: 'shu4_xue2', label: '数学' }]
    const existingStudents: StudentDataType[] = [{ [NAME_PROP]: '张三', shu4_xue2: 90 }]

    const result = buildIncrementalScoreImport({
      rows: [{ 姓名: '张三', 数学: '99', 英语: '88' }],
      existingStudents,
      existingHeaders,
      selectedColumns: ['数学', '英语'],
      conflictActions: { 数学: 'skip' }
    })

    const englishHeader = result.headers.find((header) => header.label === '英语')

    expect(result.stats.skippedColumnCount).toBe(1)
    expect(result.stats.addedColumnCount).toBe(1)
    expect(result.students[0].shu4_xue2).toBe(90)
    expect(result.students[0][englishHeader!.prop]).toBe(88)
  })

  it('detects duplicate names and score column conflicts', () => {
    expect(findDuplicateNames([{ 姓名: '张三' }, { 姓名: ' 张三 ' }, { 姓名: '李四' }], '姓名')).toEqual([
      '张三'
    ])
    expect(getConflictLabels(['数学', '英语'], [{ prop: 'shu4_xue2', label: '数学' }])).toEqual([
      '数学'
    ])
  })

  it('parses score values into numbers or null', () => {
    expect(parseScoreValue('98').value).toBe(98)
    expect(parseScoreValue('')).toEqual({ value: null, invalid: false })
    expect(parseScoreValue('缺考')).toEqual({ value: null, invalid: true })
    expect(parseScoreValue(true)).toEqual({ value: null, invalid: true })
  })
})
