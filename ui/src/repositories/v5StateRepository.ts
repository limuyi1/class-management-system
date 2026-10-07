import { clearServerAssets } from './v5AssetRepository'
import { reactive } from 'vue'
import { ElMessageBox } from 'element-plus'
import { apiRequest } from '@/api/client'
import { pruneSystemSeatingCharts, pruneSystemDutyRosters } from '@/utils/studentDeletionUtil'
import type { SeatingChartType } from '@/types/SeatingChart'
import type { DutyRosterType } from '@/types/DutyRoster'
import { bindWorkspaceRevision } from '@/utils/workspaceSessionUtil'
import type { PiniaPluginContext, StoreGeneric } from 'pinia'
import type { V5StateType } from '../../../packages/shared/src/V5'
import type { WorkspaceRecordType } from '@/types/ApiWorkspace'
import type { ScoreStateType } from '@/types/ApiScores'
import type {
  WorkspaceSnapshotType,
  WorkspaceCatalogType,
  WorkspaceReferenceType,
  CreateWorkspaceOptionsType
} from '@/types/Workspace'

export const serverMode = import.meta.env.VITE_STORAGE_MODE !== 'legacy'
export const serverState = reactive({
  loading: true,
  saving: false,
  error: '',
  workspaceId: '',
  ownerId: '',
  dirty: false
})
const stores = new Map<string, StoreGeneric>(),
  defaults = new Map<string, Record<string, unknown>>()
const tracked = new Set([
  'dataSource',
  'setting',
  'configuration',
  'tools',
  'aiConfig',
  'overviewAnalysis',
  'seatingChart',
  'dutyRoster',
  'scoreNotice'
])
let applying = false,
  epoch = 0,
  snapshot: V5StateType | null = null
let baseline: Record<string, string> = {},
  timer: ReturnType<typeof setTimeout> | undefined
let pending: { fingerprint: string; key: string } | undefined
let writing: Promise<void> | undefined
let records: WorkspaceRecordType[] = []
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T
const stateOf = (store: StoreGeneric): Record<string, unknown> => {
  const state = clone(store.$state)
  if (store.$id === 'dataSource') return { students: state.students }
  if (store.$id === 'aiConfig') return { prompts: state.prompts }
  return state
}
/** 原页面状态仅作草稿与缓存，所有变更通过服务端 CAS 保存，不接入 Dexie。 */
export function createServerStatePlugin() {
  return ({ store }: PiniaPluginContext): void => {
    if (!tracked.has(store.$id) && store.$id !== 'workspace') return
    stores.set(store.$id, store)
    defaults.set(store.$id, clone(store.$state))
    store.$subscribe(
      () => {
        if (applying || serverState.loading || !snapshot || !tracked.has(store.$id)) return
        serverState.dirty = Object.entries(baseline).some(
          ([id, value]) => stores.has(id) && JSON.stringify(stateOf(stores.get(id)!)) !== value
        )
        if (serverState.dirty && !serverState.error) {
          clearTimeout(timer)
          timer = setTimeout(() => void flushServerState().catch(() => undefined), 250)
        }
      },
      { deep: true, flush: 'sync', detached: true }
    )
  }
}
/** 登出或切换账号立即清除旧缓存及草稿；已发请求按代次作废。 */
export function clearServerState(): void {
  clearServerAssets()
  epoch++
  clearTimeout(timer)
  snapshot = null
  baseline = {}
  pending = undefined
  records = []
  applying = true
  for (const [id, store] of stores)
    store.$patch((state) => Object.assign(state, clone(defaults.get(id)!)))
  applying = false
  Object.assign(serverState, {
    loading: true,
    saving: false,
    error: '',
    workspaceId: '',
    ownerId: '',
    dirty: false
  })
}
function selectionKey(): string {
  return `cms-workspace:${serverState.ownerId}`
}
function selectedId(): string {
  try {
    return sessionStorage.getItem(selectionKey()) || ''
  } catch {
    return ''
  }
}
function selectId(id: string): void {
  try {
    sessionStorage.setItem(selectionKey(), id)
  } catch {
    /* 本次会话仍可切换。 */
  }
}
function apply(result: V5StateType): void {
  applying = true
  snapshot = result
  for (const [id, state] of Object.entries(result.stores)) {
    const store = stores.get(id)
    if (store) {
      const next = { ...clone(defaults.get(id)!), ...state }
      if (id === 'aiConfig')
        next.prompts = {
          ...(defaults.get(id)?.prompts as Record<string, unknown>),
          ...(state.prompts as Record<string, unknown>)
        }
      store.$patch((state) => Object.assign(state, next))
    }
  }
  const data = stores.get('dataSource')
  if (data) {
    data.isDataReady = true
    data.initError = null
  }
  baseline = Object.fromEntries(
    [...stores]
      .filter(([id]) => tracked.has(id))
      .map(([id, store]) => [id, JSON.stringify(stateOf(store))])
  )
  applying = false
  serverState.dirty = false
  serverState.error = ''
}
/** 目录和参照快照来自服务器，同一用户选择只保存在当前设备会话中。 */
export async function loadServerWorkspace(
  ownerId = serverState.ownerId,
  id?: string
): Promise<void> {
  const current = ++epoch
  serverState.loading = true
  serverState.ownerId = ownerId
  serverState.error = ''
  try {
    const catalog = await apiRequest<{ items: WorkspaceRecordType[] }>('/workspaces')
    if (current !== epoch) return
    if (!catalog.items.length) {
      await apiRequest('/v5/default-workspace', {
        method: 'POST',
        idempotencyKey: `default-workspace-${ownerId}`
      })
      catalog.items = (await apiRequest<{ items: WorkspaceRecordType[] }>('/workspaces')).items
      if (current !== epoch) return
    }
    records = catalog.items
    const active =
      records.find((row) => row.id === (id || selectedId())) || records[records.length - 1]
    serverState.workspaceId = active?.id || ''
    const workspace = stores.get('workspace')
    if (!active) {
      applying = true
      for (const [name, store] of stores)
        if (tracked.has(name))
          store.$patch((state) => Object.assign(state, clone(defaults.get(name)!)))
      if (workspace) {
        workspace.catalog = null
        workspace.snapshots = []
      }
      const data = stores.get('dataSource')
      if (data) data.isDataReady = true
      applying = false
      snapshot = null
      return
    }
    const periodStates = await Promise.all(
      records.map((row) => apiRequest<ScoreStateType>(`/workspaces/${row.id}/scores`))
    )
    const result = await apiRequest<V5StateType>(`/v5/workspaces/${active.id}`)
    if (current !== epoch) return
    const stamp = new Date().toISOString()
    const snapshots: WorkspaceSnapshotType[] = periodStates.map((state) => ({
      id: state.workspace.id,
      students: state.students.map((row) => ({
        studentId: row.studentId,
        name: row.name,
        disabled: row.disabled,
        departed: row.departed,
        ...Object.fromEntries(
          state.assessments.map((column) => [
            column.prop,
            state.scores.find(
              (score) => score.assessmentId === column.id && score.studentId === row.studentId
            )?.value ?? null
          ])
        )
      })),
      setting: {
        id: 'main',
        updatedAt: stamp,
        scoreColumns: [
          { prop: 'name', label: '姓名', disabled: false },
          ...state.assessments.map((column) => ({
            prop: column.prop,
            label: column.label,
            disabled: column.disabled,
            ...(column.fullMark == null ? {} : { fullMark: column.fullMark })
          }))
        ],
        tags: {},
        tagCategories: []
      },
      preferences: {
        inputScoreTab: null,
        recentScoreEntries: {},
        scoreFullMark: state.workspace.scoreFullMark
      },
      updatedAt: stamp
    }))
    const catalogValue: WorkspaceCatalogType = {
      id: 'main',
      activePeriodId: active.id,
      revision: `${active.id}:${active.version}`,
      migrationReviewed: true,
      updatedAt: stamp,
      classes: [...new Set(records.map((row) => row.classId))].map((classId) => ({
        id: classId,
        lastPeriodId: records.filter((row) => row.classId === classId).slice(-1)[0]!.id
      })),
      periods: periodStates.map((state) => ({
        id: state.workspace.id,
        classId: state.workspace.classId,
        className: state.workspace.className,
        termName: state.workspace.termName,
        createdAt: new Date(state.workspace.createdAt).toISOString(),
        references: state.references.map((ref) => ({
          periodId: ref.sourceWorkspaceId,
          prop:
            periodStates
              .find((other) => other.workspace.id === ref.sourceWorkspaceId)
              ?.assessments.find((column) => column.id === ref.assessmentId)?.prop || ''
        }))
      }))
    }
    applying = true
    if (workspace) {
      workspace.catalog = catalogValue
      workspace.snapshots = snapshots
    }
    applying = false
    bindWorkspaceRevision(catalogValue.revision)
    selectId(active.id)
    apply(result)
    // 个人 AI 只缓存可用摘要，密钥不返回浏览器。
    const ai = stores.get('aiConfig')
    const settings = await apiRequest<{
      mode: string
      personal: { enabled: boolean; configured: boolean }
      platform: { enabled: boolean; configured: boolean }
    }>('/me/ai')
    if (current === epoch && ai)
      ai.serverConfigured =
        settings.mode === 'PERSONAL'
          ? settings.personal.enabled && settings.personal.configured
          : settings.platform.enabled && settings.platform.configured
  } catch (error) {
    if (current !== epoch) return
    serverState.error = error instanceof Error ? error.message : '服务器数据读取失败'
    const data = stores.get('dataSource')
    if (data) {
      data.initError = serverState.error
      data.isDataReady = false
    }
    throw error
  } finally {
    if (current === epoch) serverState.loading = false
  }
}
/** 保存只提交实际变更，重试保持原键；失败保留草稿且停止自动重试。 */
export async function flushServerState(): Promise<void> {
  clearTimeout(timer)
  if (writing) {
    await writing
    if (serverState.dirty) return flushServerState()
    return
  }
  if (!snapshot || serverState.loading) {
    if (serverState.error) throw new Error(serverState.error)
    return
  }
  const values = Object.fromEntries(
    [...stores].filter(([id]) => tracked.has(id)).map(([id, store]) => [id, stateOf(store)])
  )
  const changed = Object.fromEntries(
    Object.entries(values).filter(([id, state]) => JSON.stringify(state) !== baseline[id])
  )
  if (!Object.keys(changed).length) {
    serverState.dirty = false
    return
  }
  const body = { fingerprint: snapshot.fingerprint, stores: changed },
    current = epoch,
    id = snapshot.workspaceId
  const fingerprint = JSON.stringify([id, body])
  if (pending?.fingerprint !== fingerprint) pending = { fingerprint, key: crypto.randomUUID() }
  const requestKey = pending.key
  serverState.saving = true
  writing = (async () => {
    try {
      await apiRequest<V5StateType>(`/v5/workspaces/${id}/preview`, {
        method: 'POST',
        body,
        idempotencyKey: `preview_${requestKey}`
      })
      if (current !== epoch) return
      const result = await apiRequest<V5StateType>(`/v5/workspaces/${id}`, {
        method: 'PUT',
        body,
        idempotencyKey: requestKey
      })
      if (current !== epoch) return
      snapshot = result
      pending = undefined
      // 保存期间继续编辑的值不能被响应覆盖。
      for (const [name, value] of Object.entries(changed)) baseline[name] = JSON.stringify(value)
      serverState.dirty = Object.entries(values).some(
        ([name]) => JSON.stringify(stateOf(stores.get(name)!)) !== baseline[name]
      )
      serverState.error = ''
    } catch (error) {
      if (current === epoch) serverState.error = error instanceof Error ? error.message : '保存失败'
      throw error
    } finally {
      if (current === epoch) serverState.saving = false
      writing = undefined
    }
  })()
  await writing
  if (serverState.dirty) await flushServerState()
}
/** 导航不能带着未保存或冲突状态离开；放弃须由用户确认。 */
export async function canLeaveServerWorkspace(): Promise<boolean> {
  if (serverState.saving) return false
  try {
    await flushServerState()
    return true
  } catch {
    try {
      await ElMessageBox.confirm(`${serverState.error}。是否放弃当前草稿？`, '未保存的修改', {
        type: 'warning'
      })
      await loadServerWorkspace()
      return true
    } catch {
      return false
    }
  }
}
/** 班级目录操作复用规范版本化接口，与原选择器保持一致。 */
export async function serverWorkspaceAction(action: string, args: unknown[]): Promise<unknown> {
  await flushServerState()
  const current = records.find((row) => row.id === serverState.workspaceId)
  if (current)
    current.version = (
      await apiRequest<ScoreStateType>(`/workspaces/${current.id}/scores`)
    ).workspace.version
  const key = crypto.randomUUID()
  if (action === 'switch') {
    selectId(String(args[0]))
    return
  }
  if (action === 'create') {
    const options = args[0] as CreateWorkspaceOptionsType
    const result = await apiRequest<WorkspaceRecordType>(
      current && !options.newClass ? `/workspaces/${current.id}/promote` : '/workspaces',
      {
        method: 'POST',
        idempotencyKey: key,
        body:
          current && !options.newClass
            ? {
                className: options.className,
                termName: options.termName,
                version: current.version,
                inheritStudents: options.inheritStudents,
                inheritAssessments: options.inheritColumns
              }
            : { className: options.className, termName: options.termName }
      }
    )
    if (current && options.useReference && !options.newClass) {
      const source = await apiRequest<ScoreStateType>(`/workspaces/${current.id}/scores`)
      const last = source.assessments.filter((row) => !row.disabled).slice(-1)[0]
      if (last)
        await apiRequest(`/workspaces/${result.id}/references`, {
          method: 'PUT',
          body: {
            version: result.version,
            items: [{ sourceWorkspaceId: current.id, assessmentId: last.id }]
          },
          idempotencyKey: crypto.randomUUID()
        })
    }
    selectId(result.id)
    return result.id
  }
  if (action === 'rename' || action === 'delete') {
    const target = records.find((row) => row.id === args[0])
    if (!target) throw new Error('学期不存在')
    target.version = (
      await apiRequest<ScoreStateType>(`/workspaces/${target.id}/scores`)
    ).workspace.version
    return apiRequest(`/workspaces/${target.id}`, {
      method: action === 'rename' ? 'PATCH' : 'DELETE',
      idempotencyKey: key,
      body:
        action === 'rename'
          ? { className: args[1], termName: args[2], version: target.version }
          : { version: target.version, wholeClass: false }
    })
  }
  if (!current) throw new Error('请先创建班级学期')
  const fresh = await apiRequest<ScoreStateType>(`/workspaces/${current.id}/scores`)
  if (action === 'references') {
    const references = args[0] as WorkspaceReferenceType[]
    const items = await Promise.all(
      references.map(async (ref) => {
        const source = await apiRequest<ScoreStateType>(`/workspaces/${ref.periodId}/scores`)
        const column = source.assessments.find((row) => row.prop === ref.prop)
        if (!column) throw new Error('参照列不存在')
        return { sourceWorkspaceId: ref.periodId, assessmentId: column.id }
      })
    )
    return apiRequest(`/workspaces/${current.id}/references`, {
      method: 'PUT',
      body: { version: fresh.workspace.version, items },
      idempotencyKey: key
    })
  }
  if (action === 'transfer') {
    const student = fresh.students.find((row) => row.studentId === args[0])
    if (!student) throw new Error('学生不存在')
    return apiRequest(`/workspaces/${current.id}/transfer`, {
      method: 'POST',
      body: { studentId: student.studentId, targetId: args[1], version: student.version },
      idempotencyKey: key
    })
  }
  if (action === 'inheritSchedules') {
    const source = await apiRequest<V5StateType>(`/v5/workspaces/${String(args[0])}`)
    for (const name of ['seatingChart', 'dutyRoster']) {
      const value = clone(source.stores[name])
      const collection = name === 'seatingChart' ? 'charts' : 'rosters'
      const validIds = new Set(
        fresh.students.filter((row) => !row.departed).map((row) => row.studentId)
      )
      value[collection] =
        name === 'seatingChart'
          ? pruneSystemSeatingCharts(value[collection] as SeatingChartType[], validIds)
          : pruneSystemDutyRosters(value[collection] as DutyRosterType[], validIds)
      for (const record of value[collection] as Record<string, unknown>[])
        record.id = crypto.randomUUID()
      stores.get(name)?.$patch((state) => Object.assign(state, value))
    }
    await flushServerState()
    return
  }
  if (action === 'checkpoint' || action === 'finishMigration') return
  throw new Error('历史拆分须使用离线迁移，不支持在线重新划分已迁移学期')
}
