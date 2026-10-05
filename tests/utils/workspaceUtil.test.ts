import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { WorkspaceCatalogType } from '../../src/types/Workspace'

// 模拟事务回滚及跨工作区业务表，验证切换完整性而非只检查调用次数。
const mocks = vi.hoisted(() => {
  const names = [
    'studentDataset',
    'scoreSettings',
    'appPreferences',
    'scoreNotice',
    'seatingCharts',
    'dutyRosters',
    'overviewAnalysisCache',
    'workspaces',
    'workspaceSnapshots'
  ]
  const records: Record<string, Map<string, Record<string, unknown>>> = {}
  const db: Record<string, unknown> = {}
  let failNextRestore = false
  const copy = <T>(value: T): T => structuredClone(value)
  names.forEach((name) => {
    records[name] = new Map()
    db[name] = {
      get: async (id: string) => copy(records[name].get(id)),
      put: async (record: Record<string, unknown>) => {
        if (name === 'studentDataset' && failNextRestore) {
          failNextRestore = false
          throw new Error('磁盘写入失败')
        }
        records[name].set(record.id as string, copy(record))
      },
      delete: async (id: string) => records[name].delete(id),
      toArray: async () => copy([...records[name].values()])
    }
  })
  db.transaction = async (_mode: string, _tables: unknown[], action: () => Promise<unknown>) => {
    const saved = copy(records)
    try {
      return await action()
    } catch (error) {
      names.forEach((name) => {
        records[name] = saved[name]
      })
      throw error
    }
  }
  return {
    db,
    records,
    flush: vi.fn(async () => {}),
    importing: vi.fn(),
    failRestore: () => {
      failNextRestore = true
    }
  }
})
vi.mock('../../src/db', () => ({ db: mocks.db, DB_ID: 'main' }))
vi.mock('../../src/plugins/persistDexie', () => ({ flushPersistedStores: mocks.flush }))
vi.mock('../../src/utils/persistDexieImportState', () => ({
  setDatabaseImporting: mocks.importing
}))

import {
  createWorkspace,
  deleteWorkspacePeriod,
  finishWorkspaceMigration,
  initializeWorkspaces,
  migrateHistoricalColumns,
  renameWorkspace,
  setWorkspaceReferences,
  switchWorkspace,
  transferWorkspaceStudent
} from '../../src/utils/workspaceUtil'
import { bindWorkspaceRevision } from '../../src/utils/workspaceSessionUtil'

const readCatalog = () => mocks.records.workspaces.get('main') as unknown as WorkspaceCatalogType
const rebind = () => bindWorkspaceRevision(readCatalog().revision)
const createOptions = {
  className: '403',
  termName: '今年',
  newClass: false,
  inheritStudents: true,
  inheritColumns: true,
  useReference: true
}

beforeEach(() => {
  Object.values(mocks.records).forEach((table) => table.clear())
  mocks.flush.mockClear()
  mocks.importing.mockClear()
  bindWorkspaceRevision(null)
  mocks.records.studentDataset.set('main', {
    id: 'main',
    students: [
      { studentId: 'a', name: '甲', final: 86, comment: '去年评语', tags: { good: ['认真'] } },
      { studentId: 'b', name: '乙', final: 90, departed: true }
    ],
    updatedAt: ''
  })
  mocks.records.scoreSettings.set('main', {
    id: 'main',
    scoreColumns: [
      { prop: 'name', label: '姓名', disabled: false },
      { prop: 'final', label: '期末', disabled: false }
    ],
    tagCategories: [{ prop: 'good', label: '优点' }],
    tags: { good: ['认真'] },
    updatedAt: ''
  })
  mocks.records.appPreferences.set('main', {
    id: 'main',
    scoreFullMark: 100,
    inputScoreTab: 'final',
    recentScoreEntries: { final: [{ studentId: 'a' }] },
    fontSize: 22,
    inscribe: '签名',
    updatedAt: ''
  })
  mocks.records.seatingCharts.set('main', { id: 'main', charts: [{ id: 'seat' }], updatedAt: '' })
})

describe('local class and term workspaces', () => {
  it('retains rotation locks and duty capacities through workspace snapshots', async () => {
    const seating = { id: 'seat', rotationFixedStudentIds: ['a'] }
    const duty = { id: 'duty', autoAssignCapacities: { 'weekly:w:p': 2 } }
    mocks.records.seatingCharts.set('main', { id: 'main', charts: [seating], updatedAt: '' })
    mocks.records.dutyRosters.set('main', { id: 'main', rosters: [duty], updatedAt: '' })
    const original = await initializeWorkspaces()
    await createWorkspace(createOptions)
    rebind()
    await switchWorkspace(original.activePeriodId)
    expect(mocks.records.seatingCharts.get('main')?.charts).toEqual([seating])
    expect(mocks.records.dutyRosters.get('main')?.rosters).toEqual([duty])
  })

  it('migrates the directory idempotently without replacing legacy business data', async () => {
    const original = structuredClone(mocks.records.studentDataset.get('main'))
    const catalog = await initializeWorkspaces()
    expect(await initializeWorkspaces()).toEqual(catalog)
    expect(catalog.migrationReviewed).toBe(false)
    expect(mocks.records.studentDataset.get('main')).toEqual(original)
  })

  it('creates a new term, retains IDs and historical reference, switches back without losing comments or scores', async () => {
    const original = await initializeWorkspaces()
    await renameWorkspace(original.activePeriodId, '303', '去年')
    const nextId = await createWorkspace(createOptions)
    expect(mocks.records.studentDataset.get('main')?.students).toEqual([
      { studentId: 'a', name: '甲', disabled: false }
    ])
    expect(mocks.records.appPreferences.get('main')).toMatchObject({
      fontSize: 22,
      inscribe: '签名',
      inputScoreTab: null,
      recentScoreEntries: {}
    })
    expect(mocks.records.seatingCharts.has('main')).toBe(false)
    expect(readCatalog().periods.find((period) => period.id === nextId)?.references).toEqual([
      { periodId: original.activePeriodId, prop: 'final' }
    ])
    rebind()
    await switchWorkspace(original.activePeriodId)
    expect(mocks.records.studentDataset.get('main')?.students).toMatchObject([
      { studentId: 'a', final: 86, comment: '去年评语' },
      { studentId: 'b', departed: true }
    ])
    expect(mocks.records.seatingCharts.get('main')?.charts).toEqual([{ id: 'seat' }])
    expect(
      readCatalog().periods.find((period) => period.id === original.activePeriodId)?.className
    ).toBe('303')
  })

  it('isolates another class and retains shared preferences', async () => {
    await initializeWorkspaces()
    await createWorkspace({ ...createOptions, newClass: true, className: '404' })
    expect(readCatalog().classes).toHaveLength(2)
    expect(mocks.records.studentDataset.get('main')?.students).toEqual([])
    expect(mocks.records.scoreSettings.has('main')).toBe(false)
    expect(mocks.records.appPreferences.get('main')?.fontSize).toBe(22)
  })

  it('rolls back catalog, current data and snapshots when a switch fails', async () => {
    const original = await initializeWorkspaces()
    await createWorkspace(createOptions)
    rebind()
    const saved = structuredClone(mocks.records)
    mocks.failRestore()
    await expect(switchWorkspace(original.activePeriodId)).rejects.toThrow('磁盘写入失败')
    expect(mocks.records).toEqual(saved)
    expect(mocks.importing).toHaveBeenLastCalledWith(false)
  })

  it('blocks stale pages and duplicate terms, and refuses deletion of active or referenced terms', async () => {
    const original = await initializeWorkspaces()
    await createWorkspace(createOptions)
    await expect(finishWorkspaceMigration()).rejects.toThrow('其他页面')
    rebind()
    await expect(createWorkspace(createOptions)).rejects.toThrow('同名学期')
    await expect(deleteWorkspacePeriod(readCatalog().activePeriodId)).rejects.toThrow('先切换')
    await expect(deleteWorkspacePeriod(original.activePeriodId)).rejects.toThrow('历史参照')
    await setWorkspaceReferences([])
    await deleteWorkspacePeriod(original.activePeriodId)
    expect(readCatalog().periods).toHaveLength(1)
  })

  it('moves legacy historical columns atomically without losing values, leaving references', async () => {
    await initializeWorkspaces()
    await migrateHistoricalColumns('303', '去年', ['final'])
    expect(
      (mocks.records.studentDataset.get('main')?.students as Record<string, unknown>[])[0]
    ).toMatchObject({ studentId: 'a', comment: '去年评语' })
    expect(
      (mocks.records.studentDataset.get('main')?.students as Record<string, unknown>[])[0]
    ).not.toHaveProperty('final')
    const source = readCatalog().periods.find((period) => period.termName === '去年')!
    expect(
      (mocks.records.workspaceSnapshots.get(source.id)?.students as Record<string, unknown>[])[0]
    ).toMatchObject({ studentId: 'a', final: 86 })
    expect(
      readCatalog().periods.find((period) => period.id === readCatalog().activePeriodId)?.references
    ).toEqual([{ periodId: source.id, prop: 'final' }])
  })

  it('transfers an identity without copying grades, preserving source history', async () => {
    const first = await initializeWorkspaces()
    await renameWorkspace(first.activePeriodId, '403', '今年')
    const target = await createWorkspace({ ...createOptions, newClass: true, className: '404' })
    rebind()
    await switchWorkspace(first.activePeriodId)
    rebind()
    await transferWorkspaceStudent('a', target)
    expect(
      (mocks.records.studentDataset.get('main')?.students as Record<string, unknown>[])[0]
    ).toMatchObject({ studentId: 'a', final: 86, departed: true })
    expect(mocks.records.workspaceSnapshots.get(target)?.students).toEqual([
      { studentId: 'a', name: '甲', disabled: false }
    ])
  })
})
