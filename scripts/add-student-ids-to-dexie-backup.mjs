#!/usr/bin/env node
/* eslint-env node */

import { randomUUID } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { basename, dirname, extname, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const STUDENT_DATASET_TABLE = 'student_dataset'
const APP_PREFERENCES_TABLE = 'app_preferences'
const STUDENT_ID_PROP = 'studentId'

const usage = () => {
  console.log('Usage: pnpm migrate:student-ids <input.dexie> [output.dexie]')
}

const isPlainRecord = (value) => Boolean(value && typeof value === 'object' && !Array.isArray(value))

const isKeyValueRow = (row) => Array.isArray(row) && row.length === 2

const getRowValue = (row) => (isKeyValueRow(row) ? row[1] : row)

const withRowValue = (row, value) => (isKeyValueRow(row) ? [row[0], value] : value)

const createOutputPath = (inputPath) => {
  const parsedInput = resolve(inputPath)
  const extension = extname(parsedInput) || '.dexie'
  const name = basename(parsedInput, extension)
  return join(dirname(parsedInput), `${name}.with-student-ids${extension}`)
}

const getDataChunks = (backup) => {
  const chunks = backup?.data?.data
  if (!Array.isArray(chunks)) {
    throw new Error('Input file does not contain dexie-export-import data chunks')
  }
  return chunks
}

const migrateRecentScoreEntries = (backup, students) => {
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
              if (
                typeof entry.studentId === 'string' &&
                validStudentIds.has(entry.studentId)
              ) {
                return [{ ...entryState, studentId: entry.studentId }]
              }

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

export const addStudentIds = (backup) => {
  if (backup?.formatName !== 'dexie' || backup?.formatVersion !== 1) {
    throw new Error('Input file is not a dexie-export-import v1 backup')
  }

  const studentChunks = getDataChunks(backup).filter(
    (chunk) => chunk?.tableName === STUDENT_DATASET_TABLE
  )
  if (!studentChunks.length || studentChunks.some((chunk) => !Array.isArray(chunk.rows))) {
    throw new Error('Input file does not contain the student_dataset table')
  }

  let addedCount = 0
  const usedIds = new Set()
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
        if (typeof currentId === 'string' && currentId.trim()) {
          if (usedIds.has(currentId)) {
            throw new Error(`Duplicate studentId found in backup: ${currentId}`)
          }
          usedIds.add(currentId)
          return student
        }

        let studentId = randomUUID()
        while (usedIds.has(studentId)) {
          studentId = randomUUID()
        }
        usedIds.add(studentId)
        addedCount += 1
        return { ...student, [STUDENT_ID_PROP]: studentId }
      })
      if (!migratedStudents.length || record.id === 'main') {
        migratedStudents = students.filter(isPlainRecord)
      }

      return withRowValue(row, { ...record, students })
    })
  })

  migrateRecentScoreEntries(backup, migratedStudents)

  return addedCount
}

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

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exit(1)
  })
}
