#!/usr/bin/env node
/* eslint-env node */

import { readFile, writeFile } from 'node:fs/promises'
import { basename, dirname, extname, join, resolve } from 'node:path'

const LEGACY_DATABASE_NAME = 'scs-database'
const DATABASE_NAME = 'score-recording-system'
const DATABASE_VERSION = 1
const NAME_PROP = 'name'
const LEGACY_NAME_PROP = 'xing4_ming2'

const TABLES = {
  studentDataset: 'student_dataset',
  scoreSettings: 'score_settings',
  appPreferences: 'app_preferences',
  themePreferences: 'theme_preferences',
  aiSettings: 'ai_settings',
  wrongBook: 'wrong_book',
  overviewAnalysisCache: 'overview_analysis_cache',
  toolPreferences: 'tool_preferences',
  attachments: 'attachments',
  paperLayoutDrafts: 'paper_layout_drafts'
}

const tableSchemas = {
  [TABLES.studentDataset]: 'id, updatedAt',
  [TABLES.scoreSettings]: 'id, updatedAt',
  [TABLES.appPreferences]: 'id, updatedAt',
  [TABLES.themePreferences]: 'id, updatedAt',
  [TABLES.aiSettings]: 'id, updatedAt',
  [TABLES.wrongBook]: 'id, updatedAt',
  [TABLES.overviewAnalysisCache]: 'id, updatedAt',
  [TABLES.toolPreferences]: 'id, updatedAt',
  [TABLES.attachments]: 'id, sortOrder, name, createdAt, updatedAt',
  [TABLES.paperLayoutDrafts]: 'id, name, createdAt, updatedAt'
}

const legacyToCurrentTable = {
  dataSource: TABLES.studentDataset,
  setting: TABLES.scoreSettings,
  configuration: TABLES.appPreferences,
  theme: TABLES.themePreferences,
  aiConfig: TABLES.aiSettings,
  wrongBook: TABLES.wrongBook,
  overviewAnalysis: TABLES.overviewAnalysisCache,
  tools: TABLES.toolPreferences,
  attachments: TABLES.attachments,
  paperLayoutDrafts: TABLES.paperLayoutDrafts
}

const nowIso = () => new Date().toISOString()

const usage = () => {
  console.log('Usage: node scripts/convert-dexie-backup.mjs <old.dexie> [new.dexie]')
}

const isKeyValueRow = (row) => Array.isArray(row) && row.length === 2

const getRowValue = (row) => (isKeyValueRow(row) ? row[1] : row)

const withRowValue = (row, value) => (isKeyValueRow(row) ? [row[0], value] : value)

const stripLegacyMeta = (record) => {
  const { updatedAt, ...state } = record
  void updatedAt
  return state
}

const addUpdatedAt = (record) => ({
  ...record,
  updatedAt: typeof record.updatedAt === 'string' ? record.updatedAt : nowIso()
})

const normalizeStudentRecord = (student) => {
  if (!student || typeof student !== 'object' || Array.isArray(student)) {
    return student
  }

  const { [LEGACY_NAME_PROP]: legacyName, ...rest } = student
  return {
    ...rest,
    [NAME_PROP]: student[NAME_PROP] ?? legacyName ?? null
  }
}

const normalizeHeaderRecord = (header) => {
  if (!header || typeof header !== 'object' || Array.isArray(header)) {
    return header
  }

  return {
    ...header,
    prop: header.prop === LEGACY_NAME_PROP ? NAME_PROP : header.prop
  }
}

const transformRecord = (legacyTableName, record) => {
  if (!record || typeof record !== 'object' || Array.isArray(record)) {
    return record
  }

  switch (legacyTableName) {
    case 'dataSource': {
      const { id = 'main', data = [], updatedAt } = record
      return {
        id,
        students: Array.isArray(data) ? data.map(normalizeStudentRecord) : [],
        updatedAt: typeof updatedAt === 'string' ? updatedAt : nowIso()
      }
    }
    case 'setting': {
      return addUpdatedAt({
        ...stripLegacyMeta(record),
        tableHeaders: Array.isArray(record.tableHeaders)
          ? record.tableHeaders.map(normalizeHeaderRecord)
          : []
      })
    }
    case 'attachments':
    case 'paperLayoutDrafts':
      return record
    default:
      return addUpdatedAt(stripLegacyMeta(record))
  }
}

const transformRows = (legacyTableName, rows) => {
  if (!Array.isArray(rows)) return []

  return rows.map((row) => {
    const value = getRowValue(row)
    const nextValue = transformRecord(legacyTableName, value)
    return withRowValue(row, nextValue)
  })
}

const createOutputPath = (inputPath) => {
  const parsedInput = resolve(inputPath)
  const extension = extname(parsedInput) || '.dexie'
  const name = basename(parsedInput, extension)
  return join(dirname(parsedInput), `${name}.converted${extension}`)
}

const convertBackup = (backup) => {
  if (backup?.formatName !== 'dexie' || backup?.formatVersion !== 1 || !backup?.data) {
    throw new Error('Input file is not a dexie-export-import v1 backup')
  }

  const chunksByTable = new Map()

  for (const chunk of backup.data.data || []) {
    const currentTableName = legacyToCurrentTable[chunk.tableName]
    if (!currentTableName) continue

    const rows = transformRows(chunk.tableName, chunk.rows)
    const existingChunk = chunksByTable.get(currentTableName)

    if (existingChunk) {
      existingChunk.rows.push(...rows)
      continue
    }

    chunksByTable.set(currentTableName, {
      tableName: currentTableName,
      inbound: chunk.inbound !== false,
      rows
    })
  }

  const data = Array.from(chunksByTable.values())
  const tables = Object.values(TABLES).map((name) => ({
    name,
    schema: tableSchemas[name],
    rowCount: data
      .filter((chunk) => chunk.tableName === name)
      .reduce((count, chunk) => count + chunk.rows.length, 0)
  }))

  return {
    formatName: 'dexie',
    formatVersion: 1,
    data: {
      databaseName: DATABASE_NAME,
      databaseVersion: DATABASE_VERSION,
      tables,
      data
    }
  }
}

const main = async () => {
  const [, , inputArg, outputArg] = process.argv

  if (!inputArg || inputArg === '--help' || inputArg === '-h') {
    usage()
    process.exit(inputArg ? 0 : 1)
  }

  const inputPath = resolve(inputArg)
  const outputPath = resolve(outputArg || createOutputPath(inputPath))
  const raw = await readFile(inputPath, 'utf8')
  const backup = JSON.parse(raw)
  const converted = convertBackup(backup)

  if (backup.data?.databaseName && backup.data.databaseName !== LEGACY_DATABASE_NAME) {
    console.warn(
      `Warning: input databaseName is "${backup.data.databaseName}", expected "${LEGACY_DATABASE_NAME}".`
    )
  }

  await writeFile(outputPath, `${JSON.stringify(converted, null, 2)}\n`, 'utf8')
  console.log(`Converted backup written to ${outputPath}`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
