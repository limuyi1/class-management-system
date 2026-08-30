/**
 * add-student-ids-to-dexie-backup 迁移脚本测试
 * 覆盖：为缺少 studentId 的学生补充 ID 并保留已有 ID、
 * 同步更新 app_preferences 中成绩记录引用的 studentId、重复 ID 时抛错。
 */

import { describe, expect, it } from 'vitest'

import { addStudentIds } from '../../scripts/add-student-ids-to-dexie-backup.mjs'

// 构造最小化的 Dexie 导出备份结构，便于针对 student_dataset 与 app_preferences 写入测试数据
const createBackup = (students: Array<Record<string, unknown>>) => ({
  formatName: 'dexie',
  formatVersion: 1,
  data: {
    databaseName: 'score-recording-system',
    databaseVersion: 1,
    tables: [],
    data: [
      {
        tableName: 'student_dataset',
        inbound: true,
        rows: [
          {
            id: 'main',
            students,
            updatedAt: '2026-01-01T00:00:00.000Z'
          }
        ]
      },
      {
        tableName: 'app_preferences',
        inbound: true,
        rows: [
          {
            id: 'main',
            recentScoreEntries: {
              math: [{ index: 1, name: '张三', score: 90, time: '10:00:00' }]
            }
          }
        ]
      }
    ]
  }
})

// 目标：验证迁移脚本补全 ID、保留已有 ID 以及对重复 ID 的校验行为
describe('add-student-ids-to-dexie-backup', () => {
  it('adds missing IDs and preserves existing IDs', () => {
    const backup = createBackup([
      { name: '张三' },
      { studentId: 'student-existing', name: '李四' }
    ])

    expect(addStudentIds(backup)).toBe(1)

    const students = backup.data.data[0].rows[0].students
    expect(students[0].studentId).toBeTruthy()
    expect(students[1].studentId).toBe('student-existing')
    expect(backup.data.data[1].rows[0].recentScoreEntries.math[0]).toEqual({
      studentId: students[0].studentId,
      name: '张三',
      score: 90,
      time: '10:00:00'
    })
    expect(addStudentIds(backup)).toBe(0)
  })

  it('rejects duplicate existing IDs', () => {
    const backup = createBackup([
      { studentId: 'student-1', name: '张三' },
      { studentId: 'student-1', name: '李四' }
    ])

    expect(() => addStudentIds(backup)).toThrow('Duplicate studentId')
  })
})
