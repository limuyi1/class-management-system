#!/usr/bin/env node
/* eslint-env node */

/**
 * 数据迁移脚本：将旧版数据库备份转换为当前 Dexie 数据库结构
 * 处理旧字段名（如 xing4_ming2 -> name）、旧 store 名到新表名的映射，
 * 以及各表记录结构的归一化与时间戳补充
 */

import { readFile, writeFile } from 'node:fs/promises'
import { basename, dirname, extname, join, resolve } from 'node:path'

// 旧版数据库名称
const LEGACY_DATABASE_NAME = 'scs-database'
// 当前数据库名称
const DATABASE_NAME = 'score-recording-system'
// 目标数据库版本
const DATABASE_VERSION = 1
// 当前学生姓名字段名
const NAME_PROP = 'name'
// 旧版学生姓名字段名
const LEGACY_NAME_PROP = 'xing4_ming2'

// 当前数据库各表名称
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

// 各表的 Dexie schema 定义
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

// 旧版 store 名到当前表名的映射
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

// 统一表名映射：兼容旧 store 名与现表名两种键
const tableNameMap = {
  ...legacyToCurrentTable,
  ...Object.fromEntries(Object.values(TABLES).map((tableName) => [tableName, tableName]))
}

/** 获取当前 ISO 时间字符串 */
const nowIso = () => new Date().toISOString()

/** 打印命令行用法说明 */
const usage = () => {
  console.log('Usage: node scripts/convert-dexie-backup.mjs <old.dexie> [new.dexie]')
}

/** 判断行是否为 [key, value] 键值对格式 */
const isKeyValueRow = (row) => Array.isArray(row) && row.length === 2

/** 判断值是否为普通对象（排除数组与 null） */
const isPlainRecord = (value) => Boolean(value && typeof value === 'object' && !Array.isArray(value))

/** 从行中取出实际记录值（兼容键值对与直接值两种格式） */
const getRowValue = (row) => (isKeyValueRow(row) ? row[1] : row)

/** 将处理后的值按原行格式放回 */
const withRowValue = (row, value) => (isKeyValueRow(row) ? [row[0], value] : value)

/** 递归移除 Dexie 序列化时写入的 $types 元数据 */
const stripDexieTypesMeta = (value) => {
  if (Array.isArray(value)) {
    return value.map(stripDexieTypesMeta)
  }

  if (!isPlainRecord(value)) {
    return value
  }

  return Object.entries(value).reduce((result, [key, currentValue]) => {
    if (key === '$types') return result
    result[key] = stripDexieTypesMeta(currentValue)
    return result
  }, {})
}

/** 移除旧记录中的 updatedAt 字段（后续统一重新生成） */
const stripLegacyMeta = (record) => {
  const { updatedAt, ...state } = record
  void updatedAt
  return state
}

/** 补充 updatedAt 字段：已有字符串时间则保留，否则使用当前时间 */
const addUpdatedAt = (record) => ({
  ...record,
  updatedAt: typeof record.updatedAt === 'string' ? record.updatedAt : nowIso()
})

/** 学生记录归一化：将旧版姓名字段 xing4_ming2 迁移为 name */
const normalizeStudentRecord = (student) => {
  if (!student || typeof student !== 'object' || Array.isArray(student)) {
    return student
  }

  const { [LEGACY_NAME_PROP]: legacyName, ...rest } = stripDexieTypesMeta(student)
  return {
    ...rest,
    [NAME_PROP]: student[NAME_PROP] ?? legacyName ?? null
  }
}

/** 表头记录归一化：将旧版姓名字段的 prop 值迁移为 name */
const normalizeHeaderRecord = (header) => {
  if (!header || typeof header !== 'object' || Array.isArray(header)) {
    return header
  }

  return {
    ...stripDexieTypesMeta(header),
    prop: header.prop === LEGACY_NAME_PROP ? NAME_PROP : header.prop
  }
}

/** 按旧表名将单条记录转换为当前表结构 */
const transformRecord = (legacyTableName, record) => {
  if (!isPlainRecord(record)) {
    return record
  }

  switch (legacyTableName) {
    // 旧 dataSource store：data 数组转换为 students 结构
    case 'dataSource': {
      const { id = 'main', data = [], updatedAt } = stripDexieTypesMeta(record)
      return {
        id,
        students: Array.isArray(data) ? data.map(normalizeStudentRecord) : [],
        updatedAt: typeof updatedAt === 'string' ? updatedAt : nowIso()
      }
    }
    // 现 student_dataset 表：兼容 data / students 两种字段名
    case TABLES.studentDataset: {
      const { data, students = [], ...state } = stripLegacyMeta(stripDexieTypesMeta(record))
      void data
      return addUpdatedAt({
        ...state,
        students: Array.isArray(students) ? students.map(normalizeStudentRecord) : []
      })
    }
    // 旧 setting store：兼容 tableHeaders / tagCategory 旧字段名
    case 'setting': {
      const cleanRecord = stripDexieTypesMeta(record)
      const scoreColumns = Array.isArray(cleanRecord.scoreColumns)
        ? cleanRecord.scoreColumns
        : cleanRecord.tableHeaders
      const tagCategories = Array.isArray(cleanRecord.tagCategories)
        ? cleanRecord.tagCategories
        : cleanRecord.tagCategory
      const { tableHeaders, tagCategory, ...state } = stripLegacyMeta(cleanRecord)
      void tableHeaders
      void tagCategory
      return addUpdatedAt({
        ...state,
        scoreColumns: Array.isArray(scoreColumns) ? scoreColumns.map(normalizeHeaderRecord) : [],
        tagCategories: Array.isArray(tagCategories) ? tagCategories : []
      })
    }
    // 现 score_settings 表：同样兼容 tableHeaders / tagCategory 旧字段名
    case TABLES.scoreSettings: {
      const cleanRecord = stripDexieTypesMeta(record)
      const scoreColumns = Array.isArray(cleanRecord.scoreColumns)
        ? cleanRecord.scoreColumns
        : cleanRecord.tableHeaders
      const tagCategories = Array.isArray(cleanRecord.tagCategories)
        ? cleanRecord.tagCategories
        : cleanRecord.tagCategory
      const { tableHeaders, tagCategory, ...state } = stripLegacyMeta(cleanRecord)
      void tableHeaders
      void tagCategory
      return addUpdatedAt({
        ...state,
        scoreColumns: Array.isArray(scoreColumns) ? scoreColumns.map(normalizeHeaderRecord) : [],
        tagCategories: Array.isArray(tagCategories) ? tagCategories : []
      })
    }
    // 附件与试卷草稿表结构未变，原样返回
    case 'attachments':
    case 'paperLayoutDrafts':
    case TABLES.attachments:
    case TABLES.paperLayoutDrafts:
      return record
    // 其余表：仅做元数据清理并补充 updatedAt
    default:
      return addUpdatedAt(stripLegacyMeta(stripDexieTypesMeta(record)))
  }
}

/** 转换一个分块内的所有行，跳过无法转换的记录 */
const transformRows = (legacyTableName, rows) => {
  if (!Array.isArray(rows)) return []

  return rows.reduce((convertedRows, row) => {
    const value = getRowValue(row)
    const nextValue = transformRecord(legacyTableName, value)

    if (!isPlainRecord(nextValue)) {
      return convertedRows
    }

    convertedRows.push(withRowValue(row, nextValue))
    return convertedRows
  }, [])
}

/** 将备份数据归一化为分块数组，兼容数组与按表名分组的对象两种格式 */
const normalizeDataChunks = (backupData) => {
  const chunks = backupData?.data

  if (Array.isArray(chunks)) {
    return chunks.filter(isPlainRecord)
  }

  if (!isPlainRecord(chunks)) {
    return []
  }

  return Object.entries(chunks).map(([tableName, value]) => {
    if (Array.isArray(value)) {
      return {
        tableName,
        inbound: true,
        rows: value
      }
    }

    if (isPlainRecord(value)) {
      return {
        tableName,
        inbound: value.inbound !== false,
        rows: Object.hasOwn(value, 'rows') ? (Array.isArray(value.rows) ? value.rows : []) : [value]
      }
    }

    return {
      tableName,
      inbound: true,
      rows: []
    }
  })
}

/** 根据输入路径生成默认输出路径：文件名追加 .converted 后缀 */
const createOutputPath = (inputPath) => {
  const parsedInput = resolve(inputPath)
  const extension = extname(parsedInput) || '.dexie'
  const name = basename(parsedInput, extension)
  return join(dirname(parsedInput), `${name}.converted${extension}`)
}

/** 将整个备份转换为当前数据库结构 */
const convertBackup = (backup) => {
  // 校验输入必须是 dexie-export-import v1 备份
  if (backup?.formatName !== 'dexie' || backup?.formatVersion !== 1 || !backup?.data) {
    throw new Error('Input file is not a dexie-export-import v1 backup')
  }

  // 按当前表名收集各分块的行数据
  const chunksByTable = new Map()

  for (const chunk of normalizeDataChunks(backup.data)) {
    const currentTableName = tableNameMap[chunk.tableName]
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
  // 生成 tables 元信息：表名、schema 定义与行数统计
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

/** 脚本入口：读取旧备份、执行转换并写出新备份 */
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

  // 数据库名称与预期不符时给出提示，避免误转换其他项目的备份
  if (
    backup.data?.databaseName &&
    backup.data.databaseName !== LEGACY_DATABASE_NAME &&
    backup.data.databaseName !== DATABASE_NAME
  ) {
    console.warn(
      `Warning: input databaseName is "${backup.data.databaseName}", expected "${LEGACY_DATABASE_NAME}".`
    )
  }

  await writeFile(outputPath, `${JSON.stringify(converted, null, 2)}\n`, 'utf8')
  console.log(`Converted backup written to ${outputPath}`)
}

// 直接执行入口：捕获并打印错误后以非零码退出
main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
