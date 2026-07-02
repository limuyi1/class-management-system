import { pinyin } from 'pinyin-pro'

import { NAME_PROP } from '@/types/Constants'
import type { SettingType } from '@/types/Setting'
import type { StudentDataType } from '@/types/StudentData'

export type ExcelCellValueType = string | number | boolean | null | undefined
export type ExcelRowType = Record<string, ExcelCellValueType>
export type ConflictActionType = 'overwrite' | 'skip'

export interface ScoreValueResultType {
  value: number | null
  invalid: boolean
}

export interface ScoreImportStatsType {
  invalidScoreCount: number
  ignoredStudentCount: number
  addedColumnCount: number
  overwrittenColumnCount: number
  skippedColumnCount: number
}

export interface InitialScoreImportResultType {
  headers: SettingType[]
  students: StudentDataType[]
  invalidScoreCount: number
}

export interface IncrementalScoreImportResultType {
  headers: SettingType[]
  students: StudentDataType[]
  stats: ScoreImportStatsType
}

const normalizeName = (value: ExcelCellValueType): string => {
  if (value === null || value === undefined) return ''
  return String(value).trim()
}

const createScoreProp = (label: string): string => {
  const prop = pinyin(label, { toneType: 'num', type: 'array' }).join('_')
  return prop || label
}

const createHeader = (label: string): SettingType => ({
  prop: createScoreProp(label),
  label,
  disabled: false
})

export const parseScoreValue = (value: ExcelCellValueType): ScoreValueResultType => {
  if (value === null || value === undefined || value === '') {
    return { value: null, invalid: false }
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? { value, invalid: false } : { value: null, invalid: true }
  }

  if (typeof value === 'string') {
    const trimmedValue = value.trim()
    if (!trimmedValue) {
      return { value: null, invalid: false }
    }
    const parsedValue = Number(trimmedValue)
    return Number.isFinite(parsedValue)
      ? { value: parsedValue, invalid: false }
      : { value: null, invalid: true }
  }

  return { value: null, invalid: true }
}

export const findDuplicateNames = (
  rows: Array<ExcelRowType | StudentDataType>,
  nameKey: string
): string[] => {
  const nameCount = new Map<string, number>()

  rows.forEach((row) => {
    const name = normalizeName(row[nameKey] as ExcelCellValueType)
    if (!name) return
    nameCount.set(name, (nameCount.get(name) || 0) + 1)
  })

  return Array.from(nameCount.entries())
    .filter(([, count]) => count > 1)
    .map(([name]) => name)
}

export const getConflictLabels = (
  selectedColumns: string[],
  existingHeaders: SettingType[]
): string[] => {
  const existingLabelSet = new Set(existingHeaders.map((header) => header.label))
  return selectedColumns.filter((column) => existingLabelSet.has(column))
}

export const buildInitialScoreImport = (options: {
  rows: ExcelRowType[]
  nameColumn: string
  scoreColumns: string[]
}): InitialScoreImportResultType => {
  const headers = options.scoreColumns.map(createHeader)
  let invalidScoreCount = 0

  const students = options.rows
    .map((row) => {
      const name = normalizeName(row[options.nameColumn])
      if (!name) return null

      const student = headers.reduce(
        (acc, header) => {
          const scoreResult = parseScoreValue(row[header.label])
          if (scoreResult.invalid) {
            invalidScoreCount += 1
          }
          acc[header.prop] = scoreResult.value
          return acc
        },
        { [NAME_PROP]: name } as StudentDataType
      )

      return student
    })
    .filter((student): student is StudentDataType => student !== null)

  return {
    headers,
    students,
    invalidScoreCount
  }
}

export const buildIncrementalScoreImport = (options: {
  rows: ExcelRowType[]
  existingStudents: StudentDataType[]
  existingHeaders: SettingType[]
  nameColumn: string
  selectedColumns: string[]
  conflictActions: Record<string, ConflictActionType>
}): IncrementalScoreImportResultType => {
  const existingHeaderByLabel = new Map(
    options.existingHeaders.map((header) => [header.label, header])
  )
  const headers = [...options.existingHeaders]
  const columnHeaders = new Map<string, SettingType>()
  const stats: ScoreImportStatsType = {
    invalidScoreCount: 0,
    ignoredStudentCount: 0,
    addedColumnCount: 0,
    overwrittenColumnCount: 0,
    skippedColumnCount: 0
  }

  options.selectedColumns.forEach((column) => {
    const existingHeader = existingHeaderByLabel.get(column)
    if (existingHeader) {
      if (options.conflictActions[column] === 'overwrite') {
        columnHeaders.set(column, existingHeader)
        stats.overwrittenColumnCount += 1
      } else {
        stats.skippedColumnCount += 1
      }
      return
    }

    const header = createHeader(column)
    headers.push(header)
    columnHeaders.set(column, header)
    stats.addedColumnCount += 1
  })

  const existingNames = new Set(
    options.existingStudents
      .map((student) => normalizeName(student[NAME_PROP] as ExcelCellValueType))
      .filter(Boolean)
  )
  const excelRowsByName = new Map<string, ExcelRowType>()

  options.rows.forEach((row) => {
    const name = normalizeName(row[options.nameColumn])
    if (!name) return
    if (!existingNames.has(name)) {
      stats.ignoredStudentCount += 1
      return
    }
    excelRowsByName.set(name, row)
  })

  const students = options.existingStudents.map((student) => {
    const name = normalizeName(student[NAME_PROP] as ExcelCellValueType)
    const excelRow = excelRowsByName.get(name)
    if (!excelRow) return { ...student }

    const nextStudent: StudentDataType = { ...student }
    columnHeaders.forEach((header, column) => {
      const scoreResult = parseScoreValue(excelRow[column])
      if (scoreResult.invalid) {
        stats.invalidScoreCount += 1
      }
      nextStudent[header.prop] = scoreResult.value
    })

    return nextStudent
  })

  return {
    headers,
    students,
    stats
  }
}
