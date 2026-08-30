#!/usr/bin/env node
/* eslint-env node */

/**
 * 数据迁移脚本：为 Dexie 导出的备份文件补充缺失的学生 ID
 * 旧版数据以 index 关联学生，迁移后统一使用随机生成的 studentId，
 * 并同步修正最近成绩记录（recentScoreEntries）中的学生关联方式
 */

import { randomUUID } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { basename, dirname, extname, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

// 学生数据集表名
const STUDENT_DATASET_TABLE = 'student_dataset'
// 应用偏好表名（存放最近成绩记录 recentScoreEntries）
const APP_PREFERENCES_TABLE = 'app_preferences'
// 学生唯一标识字段名
const STUDENT_ID_PROP = 'studentId'

/** 打印命令行用法说明 */
const usage = () => {
  console.log('Usage: pnpm migrate:student-ids <input.dexie> [output.dexie]')
}

/** 判断值是否为普通对象（排除数组与 null） */
const isPlainRecord = (value) => Boolean(value && typeof value === 'object' && !Array.isArray(value))

/** 判断行是否为 [key, value] 键值对格式 */
const isKeyValueRow = (row) => Array.isArray(row) && row.length === 2

/** 从行中取出实际记录值（兼容键值对与直接值两种格式） */
const getRowValue = (row) => (isKeyValueRow(row) ? row[1] : row)

/** 将处理后的值按原行格式放回 */
const withRowValue = (row, value) => (isKeyValueRow(row) ? [row[0], value] : value)

/** 根据输入路径生成默认输出路径：文件名追加 .with-student-ids 后缀 */
const createOutputPath = (inputPath) => {
  const parsedInput = resolve(inputPath)
  const extension = extname(parsedInput) || '.dexie'
  const name = basename(parsedInput, extension)
  return join(dirname(parsedInput), `${name}.with-student-ids${extension}`)
}

/** 从备份中取出数据分块列表，格式不符时抛错 */
const getDataChunks = (backup) => {
  const chunks = backup?.data?.data
  if (!Array.isArray(chunks)) {
    throw new Error('Input file does not contain dexie-export-import data chunks')
  }
  return chunks
}

/** 迁移最近成绩记录：把基于 index 的学生关联改为 studentId */
const migrateRecentScoreEntries = (backup, students) => {
  // 当前备份中所有合法 studentId 的集合
  const validStudentIds = new Set(students.map((student) => student.studentId))

  getDataChunks(backup)
    .filter((chunk) => chunk?.tableName === APP_PREFERENCES_TABLE && Array.isArray(chunk.rows))
    .forEach((chunk) => {
      chunk.rows = chunk.rows.map((row) => {
        const record = getRowValue(row)
        if (!isPlainRecord(record) || !isPlainRecord(record.recentScoreEntries)) return row

        const recentScoreEntries = Object.fromEntries(
          Object.entries(record.recentScoreEntries).map(([scoreProp, entries]) => {
            if (!Array.isArray(entries)) return [scoreProp, []]

            const migratedEntries = entries.flatMap((entry) => {
              if (!isPlainRecord(entry)) return []

              const { index, ...entryState } = entry
              // 已带合法 studentId 的条目原样保留
              if (
                typeof entry.studentId === 'string' &&
                validStudentIds.has(entry.studentId)
              ) {
                return [{ ...entryState, studentId: entry.studentId }]
              }

              // 旧版按 index 关联学生：换算为新分配的 studentId
              if (typeof index !== 'number' || !Number.isInteger(index)) return []
              const student = students[index - 1]
              if (!student) return []

              return [{ ...entryState, studentId: student.studentId }]
            })

            return [scoreProp, migratedEntries]
          })
        )

        return withRowValue(row, { ...record, recentScoreEntries })
      })
    })
}

/**
 * 为备份中所有学生补充 studentId，并返回新增 ID 的数量
 * @param backup - dexie-export-import v1 格式的备份对象
 * @returns 新增的 studentId 数量
 */
export const addStudentIds = (backup) => {
  // 校验输入必须是 dexie-export-import v1 备份
  if (backup?.formatName !== 'dexie' || backup?.formatVersion !== 1) {
    throw new Error('Input file is not a dexie-export-import v1 backup')
  }

  const studentChunks = getDataChunks(backup).filter(
    (chunk) => chunk?.tableName === STUDENT_DATASET_TABLE
  )
  if (!studentChunks.length || studentChunks.some((chunk) => !Array.isArray(chunk.rows))) {
    throw new Error('Input file does not contain the student_dataset table')
  }

  // 统计新增的 studentId 数量
  let addedCount = 0
  // 已使用的 studentId 集合，用于查重
  const usedIds = new Set()
  // 迁移后的学生列表，供迁移最近成绩记录时关联使用
  let migratedStudents = []

  studentChunks.forEach((studentChunk) => {
    studentChunk.rows = studentChunk.rows.map((row) => {
      const record = getRowValue(row)
      if (!isPlainRecord(record) || !Array.isArray(record.students)) {
        return row
      }

      const students = record.students.map((student) => {
        if (!isPlainRecord(student)) return student

        const currentId = student[STUDENT_ID_PROP]
        // 已有合法 studentId：查重后原样保留
        if (typeof currentId === 'string' && currentId.trim()) {
          if (usedIds.has(currentId)) {
            throw new Error(`Duplicate studentId found in backup: ${currentId}`)
          }
          usedIds.add(currentId)
          return student
        }

        // 缺少 studentId：生成不重复的随机 UUID
        let studentId = randomUUID()
        while (usedIds.has(studentId)) {
          studentId = randomUUID()
        }
        usedIds.add(studentId)
        addedCount += 1
        return { ...student, [STUDENT_ID_PROP]: studentId }
      })
      // 优先使用 id 为 main 的记录中的学生列表作为迁移基准
      if (!migratedStudents.length || record.id === 'main') {
        migratedStudents = students.filter(isPlainRecord)
      }

      return withRowValue(row, { ...record, students })
    })
  })

  migrateRecentScoreEntries(backup, migratedStudents)

  return addedCount
}

/** 脚本入口：读取输入文件，执行迁移并写出结果 */
const main = async () => {
  const [, , inputArg, outputArg] = process.argv
  if (!inputArg || inputArg === '--help' || inputArg === '-h') {
    usage()
    process.exit(inputArg ? 0 : 1)
  }

  const inputPath = resolve(inputArg)
  const outputPath = resolve(outputArg || createOutputPath(inputPath))
  if (inputPath === outputPath) {
    throw new Error('Output path must be different from input path')
  }

  const backup = JSON.parse(await readFile(inputPath, 'utf8'))
  const addedCount = addStudentIds(backup)
  await writeFile(outputPath, `${JSON.stringify(backup, null, 2)}\n`, 'utf8')

  console.log(`Student ID migration complete: added ${addedCount} ID(s)`)
  console.log(`Migrated backup written to ${outputPath}`)
}

// 仅在直接执行本脚本时运行（被 import 时不执行）
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exit(1)
  })
}
