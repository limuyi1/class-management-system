import { db, DB_ID } from '@/db'
import { flushPersistedStores } from '@/plugins/persistDexie'
import { setDatabaseImporting } from '@/utils/persistDexieImportState'
import {
  assertWorkspaceTasksFinished,
  bindWorkspaceRevision,
  getWorkspaceRevision
} from '@/utils/workspaceSessionUtil'
import { getValidScore } from '@/utils/scoreValueUtil'
import { pruneSystemSeatingCharts, pruneSystemDutyRosters } from '@/utils/studentDeletionUtil'
import { normalizeStoredStudents } from '@/utils/studentUtil'

import type { StudentDataType } from '@/types/StudentData'
import type {
  CreateWorkspaceOptionsType,
  WorkspaceCatalogType,
  WorkspacePeriodType,
  WorkspaceReferenceType,
  WorkspaceSnapshotType
} from '@/types/Workspace'

const scopedTables = () => [
  db.studentDataset,
  db.scoreSettings,
  db.scoreNotice,
  db.seatingCharts,
  db.dutyRosters,
  db.overviewAnalysisCache
]
const transactionTables = () => [
  ...scopedTables(),
  db.appPreferences,
  db.workspaces,
  db.workspaceSnapshots
]
let mutating = false
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T
const now = (): string => new Date().toISOString()
const createId = (): string => crypto.randomUUID()

/** 获取当前学期的元信息。 */
export function getActivePeriod(catalog: WorkspaceCatalogType): WorkspacePeriodType {
  const period = catalog.periods.find((item) => item.id === catalog.activePeriodId)
  if (!period) throw new Error('当前学期不存在，请检查备份文件')
  return period
}

/** 首次升级仅增加目录，原业务数据原地保留；旧版备份也通过此入口接入。 */
export async function initializeWorkspaces(): Promise<WorkspaceCatalogType> {
  const catalog = await db.transaction('rw', [db.workspaces, db.scoreSettings], async () => {
    const existing = await db.workspaces.get(DB_ID)
    if (existing) {
      getActivePeriod(existing)
      return existing
    }
    const classId = createId()
    const periodId = createId()
    const stamp = now()
    const setting = await db.scoreSettings.get(DB_ID)
    const initial: WorkspaceCatalogType = {
      id: DB_ID,
      activePeriodId: periodId,
      revision: createId(),
      classes: [{ id: classId, lastPeriodId: periodId }],
      periods: [
        {
          id: periodId,
          classId,
          className: '默认班级',
          termName: '当前学期',
          createdAt: stamp,
          references: []
        }
      ],
      migrationReviewed: !setting?.scoreColumns.some((column) => column.prop !== 'name'),
      updatedAt: stamp
    }
    await db.workspaces.put(initial)
    return initial
  })
  bindWorkspaceRevision(catalog.revision)
  return catalog
}

/** 读取当前工作区；调用方可在同一事务内将它保存为完整业务快照。 */
export async function captureWorkspace(periodId: string): Promise<WorkspaceSnapshotType> {
  const [dataset, setting, preferences, scoreNotice, seatingCharts, dutyRosters, overviewAnalysis] =
    await Promise.all([
      db.studentDataset.get(DB_ID),
      db.scoreSettings.get(DB_ID),
      db.appPreferences.get(DB_ID),
      db.scoreNotice.get(DB_ID),
      db.seatingCharts.get(DB_ID),
      db.dutyRosters.get(DB_ID),
      db.overviewAnalysisCache.get(DB_ID)
    ])
  return {
    id: periodId,
    students: normalizeStoredStudents(dataset?.students),
    ...(setting ? { setting } : {}),
    preferences: {
      inputScoreTab: preferences?.inputScoreTab ?? null,
      recentScoreEntries: preferences?.recentScoreEntries ?? {},
      scoreFullMark: preferences?.scoreFullMark ?? 100
    },
    ...(scoreNotice ? { scoreNotice } : {}),
    ...(seatingCharts ? { seatingCharts } : {}),
    ...(dutyRosters ? { dutyRosters } : {}),
    ...(overviewAnalysis ? { overviewAnalysis } : {}),
    updatedAt: now()
  }
}

/** 切换工作区时只替换业务表，AI、主题、字体、版式、错题与附件保留。 */
async function restoreWorkspace(snapshot: WorkspaceSnapshotType): Promise<void> {
  await db.studentDataset.put({ id: DB_ID, students: snapshot.students, updatedAt: now() })
  const entries = [
    [db.scoreSettings, snapshot.setting],
    [db.scoreNotice, snapshot.scoreNotice],
    [db.seatingCharts, snapshot.seatingCharts],
    [db.dutyRosters, snapshot.dutyRosters],
    [db.overviewAnalysisCache, snapshot.overviewAnalysis]
  ] as const
  for (const [table, record] of entries) {
    if (record) await table.put({ ...record, id: DB_ID, updatedAt: now() } as never)
    else await table.delete(DB_ID)
  }
  const preferences = await db.appPreferences.get(DB_ID)
  if (preferences)
    await db.appPreferences.put({ ...preferences, ...snapshot.preferences, updatedAt: now() })
}

/** 保存与切换在一个事务中完成；失败保留原工作区，其他标签页的旧状态不能写入。 */
async function mutateWorkspace<T>(
  action: (catalog: WorkspaceCatalogType, current: WorkspaceSnapshotType) => Promise<T>
): Promise<T> {
  assertWorkspaceTasksFinished()
  if (mutating) throw new Error('正在处理班级或学期，请稍候')
  mutating = true
  try {
    await flushPersistedStores()
    setDatabaseImporting(true)
    return await db.transaction('rw', transactionTables(), async () => {
      const stored = await db.workspaces.get(DB_ID)
      if (!stored || stored.revision !== getWorkspaceRevision()) {
        throw new Error('班级或学期已在其他页面切换，请刷新后继续')
      }
      const catalog = clone(stored)
      const snapshot = await captureWorkspace(catalog.activePeriodId)
      await db.workspaceSnapshots.put(snapshot)
      const result = await action(catalog, snapshot)
      catalog.updatedAt = now()
      await db.workspaces.put(catalog)
      return result
    })
  } finally {
    setDatabaseImporting(false)
    mutating = false
  }
}

/** 完成事务后由界面刷新页面，销毁临时表单、异步任务及所有 keep-alive 缓存。 */
export async function switchWorkspace(periodId: string): Promise<void> {
  await mutateWorkspace(async (catalog) => {
    const target = catalog.periods.find((item) => item.id === periodId)
    if (!target) throw new Error('目标学期不存在')
    if (periodId === catalog.activePeriodId) return
    const snapshot = await db.workspaceSnapshots.get(periodId)
    if (!snapshot) throw new Error('目标学期数据缺失，未切换')
    await restoreWorkspace(snapshot)
    catalog.activePeriodId = periodId
    catalog.revision = createId()
    const workspace = catalog.classes.find((item) => item.id === target.classId)
    if (workspace) workspace.lastPeriodId = periodId
  })
}

/** 新学期只沿用身份和名单状态，不带入成绩、评语及表现标签。 */
export function inheritWorkspaceStudents(students: StudentDataType[]): StudentDataType[] {
  return students
    .filter((student) => !student.departed)
    .map((student) => ({
      studentId: student.studentId,
      name: student.name,
      disabled: student.disabled ?? false
    }))
}

/** 以当前学期为来源创建新学期，或建立完全独立的新班级。 */
export async function createWorkspace(options: CreateWorkspaceOptionsType): Promise<string> {
  const className = options.className.trim()
  const termName = options.termName.trim()
  if (!className || !termName) throw new Error('请填写班级名称和学期名称')
  return mutateWorkspace(async (catalog, current) => {
    const source = getActivePeriod(catalog)
    const classId = options.newClass ? createId() : source.classId
    if (catalog.periods.some((item) => item.classId === classId && item.termName === termName)) {
      throw new Error('这个班级已经有同名学期')
    }
    if (
      catalog.periods.some((item) => item.className === className && item.termName === termName)
    ) {
      throw new Error('同一学期已经有这个班级名称')
    }
    const id = createId()
    const columns =
      current.setting?.scoreColumns.filter((item) => item.prop !== 'name' && !item.disabled) ?? []
    const lastColumn = [...columns]
      .reverse()
      .find((column) =>
        current.students.some((student) => getValidScore(student[column.prop]) !== null)
      )
    const period: WorkspacePeriodType = {
      id,
      classId,
      className,
      termName,
      createdAt: now(),
      references:
        !options.newClass && options.useReference && lastColumn
          ? [{ periodId: source.id, prop: lastColumn.prop }]
          : []
    }
    const snapshot: WorkspaceSnapshotType = {
      id,
      students:
        !options.newClass && options.inheritStudents
          ? inheritWorkspaceStudents(current.students)
          : [],
      preferences: {
        inputScoreTab: null,
        recentScoreEntries: {},
        scoreFullMark: current.preferences.scoreFullMark
      },
      updatedAt: now()
    }
    if (!options.newClass && current.setting) {
      snapshot.setting = {
        ...clone(current.setting),
        scoreColumns: options.inheritColumns
          ? clone(current.setting.scoreColumns)
          : current.setting.scoreColumns.filter((column) => column.prop === 'name')
      }
    }
    await db.workspaceSnapshots.put(snapshot)
    catalog.periods.push(period)
    const workspace = catalog.classes.find((item) => item.id === classId)
    if (workspace) workspace.lastPeriodId = id
    else catalog.classes.push({ id: classId, lastPeriodId: id })
    await restoreWorkspace(snapshot)
    catalog.activePeriodId = id
    catalog.revision = createId()
    return id
  })
}

/** 当期改名不会改变其他学期的班名。 */
export async function renameWorkspace(
  periodId: string,
  className: string,
  termName: string
): Promise<void> {
  await mutateWorkspace(async (catalog) => {
    const target = catalog.periods.find((item) => item.id === periodId)
    if (!target || !className.trim() || !termName.trim()) throw new Error('班级和学期名称不能为空')
    if (
      catalog.periods.some(
        (item) =>
          item.id !== periodId &&
          ((item.classId === target.classId && item.termName === termName.trim()) ||
            (item.className === className.trim() && item.termName === termName.trim()))
      )
    )
      throw new Error('班级或学期名称重复')
    target.className = className.trim()
    target.termName = termName.trim()
  })
}

/** 参照仅能选择本班其他学期的真实成绩列，重复和失效来源会被拒绝。 */
export async function setWorkspaceReferences(references: WorkspaceReferenceType[]): Promise<void> {
  await mutateWorkspace(async (catalog) => {
    const active = getActivePeriod(catalog)
    const seen = new Set<string>()
    for (const reference of references) {
      const source = catalog.periods.find((item) => item.id === reference.periodId)
      if (!source || source.id === active.id || source.classId !== active.classId)
        throw new Error('历史参照来源无效')
      const snapshot = await db.workspaceSnapshots.get(source.id)
      if (
        !snapshot?.setting?.scoreColumns.some(
          (column) => column.prop === reference.prop && column.prop !== 'name'
        )
      ) {
        throw new Error('历史参照成绩列不存在，请重新选择')
      }
      const key = `${source.id}:${reference.prop}`
      if (seen.has(key)) throw new Error('历史参照不能重复')
      seen.add(key)
    }
    active.references = clone(references)
  })
}

/** 仅删除非当前、未被引用的学期。 */
export async function deleteWorkspacePeriod(periodId: string): Promise<void> {
  await mutateWorkspace(async (catalog) => {
    if (periodId === catalog.activePeriodId) throw new Error('请先切换到其他学期再删除')
    if (
      catalog.periods.some((item) =>
        item.references.some((reference) => reference.periodId === periodId)
      )
    ) {
      throw new Error('这个学期正在用作历史参照，请先取消相关参照')
    }
    catalog.periods = catalog.periods.filter((item) => item.id !== periodId)
    catalog.classes = catalog.classes.filter((workspace) => {
      const periods = catalog.periods.filter((item) => item.classId === workspace.id)
      if (!periods.length) return false
      if (!periods.some((item) => item.id === workspace.lastPeriodId))
        workspace.lastPeriodId = periods[periods.length - 1].id
      return true
    })
    await db.workspaceSnapshots.delete(periodId)
  })
}

/** 导出前更新当前学期快照，保证所有班级及其业务数据一起备份。 */
export async function checkpointWorkspace(): Promise<void> {
  if (!getWorkspaceRevision()) return
  await mutateWorkspace(async () => {})
}

/** 把旧版混在当前表中的历史列移入历史学期，并建立只读参照。 */
export async function migrateHistoricalColumns(
  className: string,
  termName: string,
  props: string[]
): Promise<void> {
  if (!className.trim() || !termName.trim() || !props.length)
    throw new Error('请填写历史班名、学期并选择成绩列')
  await mutateWorkspace(async (catalog, current) => {
    const active = getActivePeriod(catalog)
    if (
      catalog.periods.some(
        (item) => item.classId === active.classId && item.termName === termName.trim()
      )
    ) {
      throw new Error('这个历史学期已经存在，请使用不同名称')
    }
    const headers =
      current.setting?.scoreColumns.filter(
        (column) => props.includes(column.prop) && column.prop !== 'name'
      ) ?? []
    if (headers.length !== new Set(props).size) throw new Error('部分成绩列不存在')
    const id = createId()
    const historic: WorkspaceSnapshotType = {
      id,
      students: current.students.map((student) => {
        const row: StudentDataType = {
          studentId: student.studentId,
          name: student.name,
          disabled: student.disabled
        }
        headers.forEach((column) => {
          row[column.prop] = student[column.prop]
        })
        return row
      }),
      setting: {
        ...clone(current.setting!),
        scoreColumns: [
          ...current.setting!.scoreColumns.filter((column) => column.prop === 'name'),
          ...headers
        ]
      },
      preferences: { ...current.preferences, inputScoreTab: null, recentScoreEntries: {} },
      updatedAt: now()
    }
    current.setting!.scoreColumns = current.setting!.scoreColumns.filter(
      (column) => !props.includes(column.prop)
    )
    current.students.forEach((student) =>
      props.forEach((prop) => {
        delete student[prop]
      })
    )
    props.forEach((prop) => {
      delete current.preferences.recentScoreEntries[prop]
    })
    if (props.includes(current.preferences.inputScoreTab ?? ''))
      current.preferences.inputScoreTab = null
    current.overviewAnalysis = undefined
    await db.workspaceSnapshots.put(historic)
    await db.workspaceSnapshots.put(current)
    await restoreWorkspace(current)
    catalog.periods.unshift({
      id,
      classId: active.classId,
      className: className.trim(),
      termName: termName.trim(),
      createdAt: now(),
      references: []
    })
    active.references.push(...headers.map((column) => ({ periodId: id, prop: column.prop })))
    catalog.migrationReviewed = true
    catalog.revision = createId()
  })
}

/** 确认现有成绩均属于当前学期，不进行移动。 */
export async function finishWorkspaceMigration(): Promise<void> {
  await mutateWorkspace(async (catalog) => {
    catalog.migrationReviewed = true
  })
}

/** 同学期转班：来源保留成绩，目标仅带入身份；已在目标班的学生不能重复加入。 */
export async function transferWorkspaceStudent(
  studentId: string,
  targetPeriodId: string
): Promise<void> {
  await mutateWorkspace(async (catalog, current) => {
    const active = getActivePeriod(catalog)
    const targetPeriod = catalog.periods.find((period) => period.id === targetPeriodId)
    if (
      !targetPeriod ||
      targetPeriod.id === active.id ||
      targetPeriod.termName !== active.termName
    ) {
      throw new Error('请选择另一个班级的同名学期')
    }
    const student = current.students.find((item) => item.studentId === studentId)
    const target = await db.workspaceSnapshots.get(targetPeriodId)
    if (!student || student.departed || !target) throw new Error('学生或目标学期不存在')
    const existing = target.students.find((item) => item.studentId === studentId)
    if (existing && !existing.departed) throw new Error('学生已经在目标班级')
    if (existing) existing.departed = false
    else target.students.push({ studentId: student.studentId, name: student.name, disabled: false })
    student.departed = true
    student.departedAt = now()
    current.overviewAnalysis = undefined
    target.overviewAnalysis = undefined
    await db.workspaceSnapshots.put({ ...target, updatedAt: now() })
    await db.workspaceSnapshots.put(current)
    await restoreWorkspace(current)
    catalog.revision = createId()
  })
}

/** 沿用往期排表，只校对系统名单，独立 Excel 来源保持原样。 */
export async function inheritWorkspaceSchedules(sourcePeriodId: string): Promise<void> {
  await mutateWorkspace(async (catalog, current) => {
    const active = getActivePeriod(catalog)
    const sourcePeriod = catalog.periods.find((period) => period.id === sourcePeriodId)
    if (!sourcePeriod || sourcePeriod.id === active.id || sourcePeriod.classId !== active.classId) {
      throw new Error('请选择本班其他学期')
    }
    const source = await db.workspaceSnapshots.get(sourcePeriodId)
    if (!source?.seatingCharts && !source?.dutyRosters)
      throw new Error('来源学期没有座位表或值日表')
    const validIds = new Set(
      current.students
        .filter((student) => !student.disabled && !student.departed)
        .map((student) => student.studentId)
    )
    if (source.seatingCharts)
      current.seatingCharts = {
        ...clone(source.seatingCharts),
        charts: pruneSystemSeatingCharts(source.seatingCharts.charts, validIds)
      }
    if (source.dutyRosters)
      current.dutyRosters = {
        ...clone(source.dutyRosters),
        rosters: pruneSystemDutyRosters(source.dutyRosters.rosters, validIds)
      }
    await db.workspaceSnapshots.put(current)
    await restoreWorkspace(current)
    catalog.revision = createId()
  })
}
