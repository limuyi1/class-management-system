import { describe, expect, it } from 'vitest'

import {
  buildIncrementalScoreImport,
  buildInitialScoreImport,
  findDuplicateNames,
  getConflictLabels,
  parseScoreValue
} from '../../src/utils/scoreImportUtil'
import { NAME_PROP } from '../../src/constants'
import type { SettingType } from '../../src/types/Setting'
import type { StudentDataType } from '../../src/types/StudentData'

describe('scoreImportUtil', () => {
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
    expect(result.headers.map((header) => header.disabled)).toEqual([false, false])
    expect(result.students).toHaveLength(2)
    expect(result.students[0].studentId).toBeTruthy()
    expect(result.students[1].studentId).not.toBe(result.students[0].studentId)
    expect(result.students[0][NAME_PROP]).toBe('张三')
    expect(result.students[0][result.headers[0].prop]).toBe(96)
    expect(result.students[1][result.headers[0].prop]).toBeNull()
    expect(result.students[1][result.headers[1].prop]).toBeNull()
    expect(result.invalidScoreCount).toBe(1)
  })

  it('builds initial students with no score columns', () => {
    const result = buildInitialScoreImport({
      rows: [{ 学生: '张三', 数学: '96' }, { 学生: '李四' }, { 学生: '' }],
      nameColumn: '学生',
      scoreColumns: []
    })

    expect(result.headers).toEqual([])
    expect(result.students.map((student) => student[NAME_PROP])).toEqual(['张三', '李四'])
    expect(result.students.every((student) => Boolean(student.studentId))).toBe(true)
    expect(result.invalidScoreCount).toBe(0)
  })

  it('adds new score columns for existing students by name', () => {
    const existingHeaders: SettingType[] = [{ prop: 'shu4_xue2', label: '数学', disabled: false }]
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
      nameColumn: '姓名',
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
    const existingHeaders: SettingType[] = [{ prop: 'shu4_xue2', label: '数学', disabled: false }]
    const existingStudents: StudentDataType[] = [{ [NAME_PROP]: '张三', shu4_xue2: 90 }]

    const result = buildIncrementalScoreImport({
      rows: [{ 姓名: '张三', 数学: '99' }],
      existingStudents,
      existingHeaders,
      nameColumn: '姓名',
      selectedColumns: ['数学'],
      conflictActions: { 数学: 'overwrite' }
    })

    expect(result.headers).toEqual(existingHeaders)
    expect(result.stats.overwrittenColumnCount).toBe(1)
    expect(result.students[0].shu4_xue2).toBe(99)
  })

  it('skips existing score columns when conflict action is skip', () => {
    const existingHeaders: SettingType[] = [{ prop: 'shu4_xue2', label: '数学', disabled: false }]
    const existingStudents: StudentDataType[] = [{ [NAME_PROP]: '张三', shu4_xue2: 90 }]

    const result = buildIncrementalScoreImport({
      rows: [{ 姓名: '张三', 数学: '99', 英语: '88' }],
      existingStudents,
      existingHeaders,
      nameColumn: '姓名',
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
    expect(
      getConflictLabels(['数学', '英语'], [
        { prop: 'shu4_xue2', label: '数学', disabled: false }
      ])
    ).toEqual(['数学'])
  })

  it('skips duplicate Excel names while importing the remaining initial students', () => {
    const result = buildInitialScoreImport({
      rows: [
        { 姓名: '张三', 数学: 90 },
        { 姓名: '张三', 数学: 80 },
        { 姓名: '李四', 数学: 88 }
      ],
      nameColumn: '姓名',
      scoreColumns: ['数学']
    })

    expect(result.students.map((student) => student[NAME_PROP])).toEqual(['李四'])
    expect(result.duplicateStudentCount).toBe(2)
  })

  it('skips ambiguous names and imports unique names incrementally', () => {
    const existingHeaders: SettingType[] = []
    const existingStudents: StudentDataType[] = [
      { studentId: 'student-1', [NAME_PROP]: '张三' },
      { studentId: 'student-2', [NAME_PROP]: '张三' },
      { studentId: 'student-3', [NAME_PROP]: '李四' }
    ]

    const result = buildIncrementalScoreImport({
      rows: [
        { 姓名: '张三', 英语: 70 },
        { 姓名: '李四', 英语: 92 }
      ],
      existingStudents,
      existingHeaders,
      nameColumn: '姓名',
      selectedColumns: ['英语'],
      conflictActions: {}
    })

    const englishHeader = result.headers[0]
    expect(result.students[0][englishHeader.prop]).toBeUndefined()
    expect(result.students[1][englishHeader.prop]).toBeUndefined()
    expect(result.students[2][englishHeader.prop]).toBe(92)
    expect(result.stats.duplicateStudentCount).toBe(1)
  })

  it('parses score values into numbers or null', () => {
    expect(parseScoreValue('98').value).toBe(98)
    expect(parseScoreValue('')).toEqual({ value: null, invalid: false })
    expect(parseScoreValue('缺考')).toEqual({ value: null, invalid: true })
    expect(parseScoreValue(true)).toEqual({ value: null, invalid: true })
  })
})
