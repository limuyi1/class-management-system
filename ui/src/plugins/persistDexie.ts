import { serverMode, flushServerState } from '@/repositories/v5StateRepository'
import type { PiniaPluginContext, StateTree, _DeepPartial } from 'pinia'
import { liveQuery, type Observable } from 'dexie'
import { getWorkspaceRevision } from '@/utils/workspaceSessionUtil'
import { db, DB_ID } from '@/db'
import type { Table } from 'dexie'
import type {
  AISettingsRecord,
  AppPreferencesRecord,
  OverviewAnalysisCacheRecord,
  ScoreSettingsRecord,
  ScoreNoticeStorageRecord,
  SeatingChartStorageRecord,
  DutyRosterStorageRecord,
  StudentDatasetRecord,
  ThemePreferencesRecord,
  ToolPreferencesRecord
} from '@/types/Database'
import type { StudentDataType } from '@/types/StudentData'

import { useDataSourceStore } from '@/stores/data-source'
import { useSettingStore } from '@/stores/setting'
import { useConfigurationStore } from '@/stores/configuration'
import { useThemeStore } from '@/stores/theme'
import { useAIConfigStore } from '@/stores/ai-config'
import { useOverviewAnalysisStore } from '@/stores/overview-analysis'
import { useToolsStore } from '@/stores/tools'
import { useScoreNoticeStore } from '@/stores/score-notice'
import { useSeatingChartStore } from '@/stores/seating-chart'
import { useDutyRosterStore } from '@/stores/duty-roster'
import { isDatabaseImporting } from '@/utils/persistDexieImportState'
import { normalizeScoreColumns } from '@/utils/settingMigrationUtil'
import { normalizeRecentScoreEntries, normalizeStoredStudents } from '@/utils/studentUtil'
import { DefaultAIPrompts, LegacyImageScorePrompt } from '@/types/AIConfig'

/** 可参与持久化的数据库记录类型联合 */
type PersistableRecordType =
  | StudentDatasetRecord
  | ScoreSettingsRecord
  | ScoreNoticeStorageRecord
  | AppPreferencesRecord
  | ThemePreferencesRecord
  | AISettingsRecord
  | OverviewAnalysisCacheRecord
  | ToolPreferencesRecord
  | SeatingChartStorageRecord
  | DutyRosterStorageRecord

/** dataSource store 在本插件中访问的字段子集 */
interface DataSourceLikeStoreType {
  isDataReady: boolean
  initError: string | null
  $state: {
    students: StudentDataType[]
  }
  $patch: (partialState: { students: StudentDataType[] }) => void
}

/** store ID 与 Dexie 表的映射，不在映射中的 store 不参与持久化 */
const tableNameMap: Record<string, Table<PersistableRecordType>> = serverMode
  ? {}
  : {
      setting: db.scoreSettings,
      configuration: db.appPreferences,
      theme: db.themePreferences,
      aiConfig: db.aiSettings,
      overviewAnalysis: db.overviewAnalysisCache,
      tools: db.toolPreferences,
      scoreNotice: db.scoreNotice,
      seatingChart: db.seatingCharts,
      dutyRoster: db.dutyRosters,
      dataSource: db.studentDataset
    }

/** 正在被 liveQuery 更新中的 store ID 集合，防止写入与同步互相触发形成循环 */
const updatingStores = new Set<string>()

/** 通过 JSON 序列化深拷贝状态，避免持久化数据与内存状态共享引用 */
const cloneState = <T>(state: T): T => JSON.parse(JSON.stringify(state)) as T

const initializationErrors = new Map<string, string>()
const pendingLoads = new Set<Promise<void>>()
const pendingWrites = new Set<Promise<void>>()
const storeSavers = new Map<string, () => Promise<void>>()

/** 切换、备份前等待初始化和已提交写入，并保存最新内存状态；失败时中止操作。 */
export async function flushPersistedStores(): Promise<void> {
  if (serverMode) {
    await flushServerState()
    return
  }
  await Promise.all([...pendingLoads])
  if (initializationErrors.size)
    throw new Error(`数据尚未完整加载：${[...initializationErrors.keys()].join('、')}，请刷新重试`)
  await Promise.all([...pendingWrites])
  for (const save of storeSavers.values()) await save()
}

/**
 * 创建基于 Dexie 的 Pinia 持久化插件
 * 将指定 store 的状态写入 IndexedDB，并通过 liveQuery 实现多来源数据同步
 * @returns Pinia 插件函数
 */
export function createPersistedStateDexie() {
  return async ({ store }: PiniaPluginContext) => {
    const storeId = store.$id
    const table = tableNameMap[storeId]

    if (!table) {
      return
    }

    const isDataSource = storeId === 'dataSource'
    const dataSourceStore = store as unknown as DataSourceLikeStoreType
    // 保存插件接入前的初始 state，用于 IndexedDB 记录被删除后恢复 store 默认值。
    // 不能依赖所有 store 都有 $reset：setup store（如 theme）没有 Pinia 自动生成的 $reset。
    const defaultState = cloneState(store.$state)
    /** 将数据库记录合并回 store 状态（含各 store 的字段归一化） */
    const patchStateFromRecord = (record: PersistableRecordType) => {
      const stateRecord = record as unknown as Record<string, unknown>
      const { id, updatedAt, ...state } = stateRecord
      // 显式标记 id/updatedAt 为有意剥离的字段，避免未使用变量告警
      void id
      void updatedAt
      if (storeId === 'aiConfig' && state.prompts && typeof state.prompts === 'object') {
        // 与默认提示词合并，补齐新增的默认项（用户自定义项优先）
        state.prompts = { ...DefaultAIPrompts, ...(state.prompts as Record<string, unknown>) }
        const prompts = state.prompts as Record<string, unknown>
        if (prompts.imageScore === LegacyImageScorePrompt) {
          prompts.imageScore = DefaultAIPrompts.imageScore
        }
      }
      if (storeId === 'setting' && Array.isArray(state.scoreColumns)) {
        // 兼容旧数据：将持久化的成绩列表头归一化为最新结构
        state.scoreColumns = normalizeScoreColumns(
          state.scoreColumns as Parameters<typeof normalizeScoreColumns>[0]
        )
      }
      if (storeId === 'configuration') {
        // 兼容旧数据：将持久化的最近成绩记录转换为标准格式
        state.recentScoreEntries = normalizeRecentScoreEntries(state.recentScoreEntries)
      }
      store.$patch(state as _DeepPartial<StateTree>)
    }
    /** 将 store 恢复为默认状态（数据库记录被删除时调用） */
    const resetStoreState = () => {
      // dataSource 在库中使用 { id, students } 结构，和 store.$state 字段不同，单独恢复。
      if (isDataSource) {
        dataSourceStore.$patch({ students: [] })
        return
      }

      store.$patch(cloneState(defaultState) as _DeepPartial<StateTree>)

      // 主题 store 还会把颜色写入 documentElement CSS 变量，仅 patch state 不会刷新页面外观。
      if (storeId === 'theme') {
        ;(store as unknown as { applyTheme?: () => void }).applyTheme?.()
      }
    }

    /** 从 IndexedDB 读取持久化记录并回填 store 状态 */
    const loadFromDB = async () => {
      try {
        const record = await table.get(DB_ID)
        initializationErrors.delete(storeId)
        if (record) {
          if (isDataSource) {
            const dataRecord = record as StudentDatasetRecord
            dataSourceStore.$patch({ students: normalizeStoredStudents(dataRecord.students) })
          } else {
            patchStateFromRecord(record)
          }
        }
      } catch (error) {
        initializationErrors.set(storeId, error instanceof Error ? error.message : '加载失败')
        console.error(`[PersistDexie] Failed to load ${storeId} from IndexedDB:`, error)
        if (isDataSource) {
          dataSourceStore.initError = error instanceof Error ? error.message : '数据加载失败'
        }
      }
    }

    if (isDataSource) {
      dataSourceStore.isDataReady = false
    }
    const loading = loadFromDB()
    pendingLoads.add(loading)
    try {
      await loading
    } finally {
      pendingLoads.delete(loading)
    }
    if (isDataSource && !dataSourceStore.initError) {
      dataSourceStore.isDataReady = true
    }

    /** 将 store 状态写入 IndexedDB（数据库导入期间跳过） */
    const saveToDB = async () => {
      if (updatingStores.has(storeId) || isDatabaseImporting()) {
        return
      }
      const revision = getWorkspaceRevision()
      const record = isDataSource
        ? {
            id: DB_ID,
            students: cloneState(dataSourceStore.$state.students),
            updatedAt: new Date().toISOString()
          }
        : {
            ...cloneState(store.$state),
            id: DB_ID,
            updatedAt: new Date().toISOString()
          }
      const write = async () => {
        if (revision && (await db.workspaces.get(DB_ID))?.revision !== revision) {
          throw new Error('班级或学期已在其他页面切换，请刷新后继续')
        }
        await table.put(record as PersistableRecordType)
      }
      if (revision) {
        await db.transaction('rw', [table, db.workspaces], write)
      } else {
        await write()
      }
    }
    storeSavers.set(storeId, saveToDB)

    // 同步订阅让 liveQuery 回填期间的保护标记有效，防止延迟订阅把旧状态写回。
    store.$subscribe(
      () => {
        const writing = saveToDB()
        pendingWrites.add(writing)
        const handled = writing
          .catch((error) => {
            console.error(`[PersistDexie] Failed to save ${storeId} to IndexedDB:`, error)
          })
          .finally(() => pendingWrites.delete(writing))
        return handled
      },
      { deep: true, flush: 'sync', detached: true }
    )

    const observable$: Observable<PersistableRecordType | undefined> = liveQuery(() =>
      table.get(DB_ID)
    ) as Observable<PersistableRecordType | undefined>
    observable$.subscribe({
      next: (record) => {
        if (isDatabaseImporting()) return
        updatingStores.add(storeId)

        try {
          // 清空系统数据会删除整张表记录；liveQuery 会推送 undefined。
          // 这里必须恢复内存 store，否则页面仍会显示清空前的状态，并可能被订阅写回数据库。
          if (!record) {
            if (isDatabaseImporting()) {
              return
            }
            resetStoreState()
            return
          }

          if (isDataSource) {
            const dataRecord = record as StudentDatasetRecord
            dataSourceStore.$patch({ students: normalizeStoredStudents(dataRecord.students) })
          } else {
            patchStateFromRecord(record)
          }
        } finally {
          updatingStores.delete(storeId)
        }
      },
      error: (err) => {
        console.error(`[PersistDexie] LiveQuery error for ${storeId}:`, err)
      }
    })
  }
}

/**
 * 预加载所有 Store
 * 在应用启动时调用，提前完成所有 store 的数据库加载
 * 避免后续页面访问时因懒加载 store 而产生卡顿
 */
export function preloadAllStores() {
  void [
    useDataSourceStore(),
    useSettingStore(),
    useConfigurationStore(),
    useThemeStore(),
    useAIConfigStore(),
    useOverviewAnalysisStore(),
    useToolsStore(),
    useScoreNoticeStore(),
    useSeatingChartStore(),
    useDutyRosterStore()
  ]
}
