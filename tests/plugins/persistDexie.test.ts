/**
 * createPersistedStateDexie 持久化插件测试
 * 覆盖：store 初始化时从 Dexie 加载数据、$subscribe 变更写回数据库、
 * 普通 store 剥离 id 字段、旧版 aiConfig 记录合并默认提示词、
 * 加载/保存失败时的错误日志、记录被删除时重置 store 状态、
 * 以及无 studentId 的遗留数据源记录视为空数据的兼容处理。
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

type ObserverType<T> = {
  next: (value: T) => void
  error?: (error: Error) => void
}

interface MockTableType {
  record: Record<string, unknown> | undefined
  get: ReturnType<typeof vi.fn>
  put: ReturnType<typeof vi.fn>
}

// 构造内存版 Dexie 表 mock：get 返回当前内存记录，put 把值写入内存
const createMockTable = (): MockTableType => {
  const table: MockTableType = {
    record: undefined,
    get: vi.fn(async () => table.record),
    put: vi.fn(async (value: Record<string, unknown>) => {
      table.record = value
    })
  }
  return table
}

// 为插件访问的每张数据库表准备独立的 mock 实例，测试间可重置
const mockTables = {
  studentDataset: createMockTable(),
  scoreSettings: createMockTable(),
  appPreferences: createMockTable(),
  themePreferences: createMockTable(),
  aiSettings: createMockTable(),
  wrongBook: createMockTable(),
  overviewAnalysisCache: createMockTable(),
  toolPreferences: createMockTable()
}

// 收集 liveQuery 订阅的观察者，便于测试中手动推送数据变更（模拟外部修改或删除记录）
const observers: Array<ObserverType<Record<string, unknown> | undefined>> = []

// mock dexie 的 liveQuery：订阅时注册观察者，并异步推送一次查询结果
vi.mock('dexie', () => {
  return {
    liveQuery: vi.fn((querier: () => Promise<Record<string, unknown> | undefined>) => {
      return {
        subscribe: (observer: ObserverType<Record<string, unknown> | undefined>) => {
          observers.push(observer)
          Promise.resolve().then(async () => {
            observer.next(await querier())
          })
          return {
            unsubscribe: vi.fn()
          }
        }
      }
    })
  }
})

// mock 项目数据库入口，把 db 的各表替换为上面的内存 mock 表
vi.mock('../../src/db', () => {
  return {
    DB_ID: 'main',
    db: {
      studentDataset: mockTables.studentDataset,
      scoreSettings: mockTables.scoreSettings,
      appPreferences: mockTables.appPreferences,
      themePreferences: mockTables.themePreferences,
      aiSettings: mockTables.aiSettings,
      wrongBook: mockTables.wrongBook,
      overviewAnalysisCache: mockTables.overviewAnalysisCache,
      toolPreferences: mockTables.toolPreferences
    }
  }
})

// mock 各 Pinia store，避免插件加载时触发真实 store 初始化
vi.mock('../../src/stores/data-source', () => ({ useDataSourceStore: vi.fn() }))
vi.mock('../../src/stores/setting', () => ({ useSettingStore: vi.fn() }))
vi.mock('../../src/stores/configuration', () => ({ useConfigurationStore: vi.fn() }))
vi.mock('../../src/stores/theme', () => ({ useThemeStore: vi.fn() }))
vi.mock('../../src/stores/ai-config', () => ({ useAIConfigStore: vi.fn() }))
vi.mock('../../src/stores/wrong-book', () => ({ useWrongBookStore: vi.fn() }))

// 目标：验证持久化插件对各类 store 的加载、保存、删除与错误处理流程
describe('createPersistedStateDexie', () => {
  beforeEach(() => {
    // 每个用例前清空观察者并重置所有 mock 表的状态
    observers.length = 0
    for (const table of Object.values(mockTables)) {
      table.record = undefined
      table.get.mockClear()
      table.put.mockClear()
    }
  })

  it('should load and save dataSource with { id, students } structure', async () => {
    mockTables.studentDataset.record = {
      id: 'main',
      students: [{ studentId: 'student-1', name: '张三', yu3_wen2: 88 }],
      updatedAt: '2026-01-01T00:00:00.000Z'
    }

    const subscribers: Array<() => Promise<void>> = []
    const store = {
      $id: 'dataSource',
      $state: { students: [] as Array<Record<string, unknown>> },
      isDataReady: false,
      $patch: (state: { students: Array<Record<string, unknown>> }) => {
        store.$state.students = state.students
      },
      $subscribe: (callback: () => Promise<void>) => {
        subscribers.push(callback)
      }
    }

    const { createPersistedStateDexie } = await import('../../src/plugins/persistDexie')
    const plugin = createPersistedStateDexie()

    await plugin({ store } as never)

    expect(store.$state.students).toEqual([
      { studentId: 'student-1', name: '张三', yu3_wen2: 88 }
    ])
    expect(store.isDataReady).toBe(true)

    store.$state.students = [{ studentId: 'student-2', name: '李四', yu3_wen2: 95 }]
    await subscribers[0]()

    expect(mockTables.studentDataset.put).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'main',
        students: [{ studentId: 'student-2', name: '李四', yu3_wen2: 95 }]
      })
    )

    const observer = observers[0]
    observer.next({
      id: 'main',
      students: [{ studentId: 'student-3', name: '王五', yu3_wen2: 76 }],
      updatedAt: '2026-01-01T00:00:00.000Z'
    })
    expect(store.$state.students).toEqual([
      { studentId: 'student-3', name: '王五', yu3_wen2: 76 }
    ])
  })

  it('should load and patch normal store by stripping id field', async () => {
    mockTables.scoreSettings.record = {
      id: 'main',
      scoreColumns: [{ prop: 'name', label: '姓名' }],
      tagCategories: [],
      tags: {},
      updatedAt: '2026-01-01T00:00:00.000Z'
    }

    const subscribers: Array<() => Promise<void>> = []
    const store = {
      $id: 'setting',
      $state: {
        scoreColumns: [] as Array<Record<string, unknown>>,
        tagCategories: [] as Array<Record<string, unknown>>,
        tags: {} as Record<string, string[]>
      },
      $patch: (state: Record<string, unknown>) => {
        store.$state = {
          ...store.$state,
          ...state
        }
      },
      $subscribe: (callback: () => Promise<void>) => {
        subscribers.push(callback)
      }
    }

    const { createPersistedStateDexie } = await import('../../src/plugins/persistDexie')
    const plugin = createPersistedStateDexie()

    await plugin({ store } as never)

    expect(store.$state.scoreColumns).toEqual([{ prop: 'name', label: '姓名', disabled: false }])

    store.$state.tags = { xing_ge: ['活泼'] }
    await subscribers[0]()

    expect(mockTables.scoreSettings.put).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'main',
        scoreColumns: [{ prop: 'name', label: '姓名', disabled: false }],
        tagCategories: [],
        tags: { xing_ge: ['活泼'] }
      })
    )
  })

  it('should merge missing default AI prompts when loading old aiConfig records', async () => {
    mockTables.aiSettings.record = {
      id: 'main',
      modelType: 'openai',
      model: 'test-model',
      apiKey: 'test-key',
      baseUrl: 'https://example.com/v1',
      prompts: {
        singleComment: '旧版单个评语提示词'
      },
      availableModels: [],
      updatedAt: '2026-01-01T00:00:00.000Z'
    }

    const store = {
      $id: 'aiConfig',
      $state: {
        prompts: {} as Record<string, string>
      },
      $patch: (state: Record<string, unknown>) => {
        store.$state = {
          ...store.$state,
          ...state
        } as typeof store.$state
      },
      $subscribe: vi.fn()
    }

    const { DefaultAIPrompts } = await import('../../src/types/AIConfig')
    const { createPersistedStateDexie } = await import('../../src/plugins/persistDexie')
    const plugin = createPersistedStateDexie()

    await plugin({ store } as never)

    expect(store.$state.prompts.singleComment).toBe('旧版单个评语提示词')
    expect(store.$state.prompts.tagCategoryGenerate).toBe(DefaultAIPrompts.tagCategoryGenerate)
  })

  it('should catch and log load errors from db.get', async () => {
    mockTables.scoreSettings.get.mockRejectedValueOnce(new Error('load failed'))
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const store = {
      $id: 'setting',
      $state: {
        scoreColumns: [] as Array<Record<string, unknown>>,
        tagCategories: [] as Array<Record<string, unknown>>,
        tags: {} as Record<string, string[]>
      },
      $patch: vi.fn(),
      $subscribe: vi.fn()
    }

    const { createPersistedStateDexie } = await import('../../src/plugins/persistDexie')
    const plugin = createPersistedStateDexie()

    await plugin({ store } as never)

    expect(errorSpy).toHaveBeenCalled()
    expect(errorSpy.mock.calls[0]?.[0]).toContain('Failed to load setting')

    errorSpy.mockRestore()
  })

  it('should catch and log save errors from db.put', async () => {
    const subscribers: Array<() => Promise<void>> = []
    const store = {
      $id: 'dataSource',
      $state: { students: [{ name: '张三', yu3_wen2: 88 }] as Array<Record<string, unknown>> },
      isDataReady: false,
      $patch: vi.fn(),
      $subscribe: (callback: () => Promise<void>) => {
        subscribers.push(callback)
      }
    }

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    mockTables.studentDataset.put.mockRejectedValueOnce(new Error('save failed'))

    const { createPersistedStateDexie } = await import('../../src/plugins/persistDexie')
    const plugin = createPersistedStateDexie()

    await plugin({ store } as never)
    await subscribers[0]()

    expect(errorSpy).toHaveBeenCalled()
    expect(
      errorSpy.mock.calls.some(
        (call) => typeof call[0] === 'string' && call[0].includes('Failed to save dataSource')
      )
    ).toBe(true)

    errorSpy.mockRestore()
  })

  it('should reset store state when persisted record is deleted', async () => {
    const store = {
      $id: 'setting',
      $state: {
        scoreColumns: [] as Array<Record<string, unknown>>,
        tagCategories: [] as Array<Record<string, unknown>>,
        tags: {} as Record<string, string[]>
      },
      $patch: (state: Record<string, unknown>) => {
        store.$state = {
          ...store.$state,
          ...state
        }
      },
      $subscribe: vi.fn()
    }

    const { createPersistedStateDexie } = await import('../../src/plugins/persistDexie')
    const plugin = createPersistedStateDexie()

    await plugin({ store } as never)

    observers[0].next({
      id: 'main',
      scoreColumns: [{ prop: 'name', label: '姓名' }],
      tagCategories: [{ prop: 'you1_dian3', label: '优点' }],
      tags: { you1_dian3: ['认真'] },
      updatedAt: '2026-01-01T00:00:00.000Z'
    })
    expect(store.$state.scoreColumns).toEqual([{ prop: 'name', label: '姓名', disabled: false }])

    observers[0].next(undefined)
    expect(store.$state).toEqual({
      scoreColumns: [],
      tagCategories: [],
      tags: {}
    })
  })

  it('should reset dataSource to empty students when persisted record is deleted', async () => {
    const store = {
      $id: 'dataSource',
      $state: { students: [] as Array<Record<string, unknown>> },
      isDataReady: false,
      $patch: (state: { students: Array<Record<string, unknown>> }) => {
        store.$state.students = state.students
      },
      $subscribe: vi.fn()
    }

    const { createPersistedStateDexie } = await import('../../src/plugins/persistDexie')
    const plugin = createPersistedStateDexie()

    await plugin({ store } as never)

    observers[0].next({
      id: 'main',
      students: [{ studentId: 'student-1', name: '张三' }],
      updatedAt: '2026-01-01T00:00:00.000Z'
    })
    expect(store.$state.students).toEqual([{ studentId: 'student-1', name: '张三' }])

    observers[0].next(undefined)
    expect(store.$state.students).toEqual([])
  })

  it('should treat legacy dataSource records without student IDs as empty data', async () => {
    mockTables.studentDataset.record = {
      id: 'main',
      students: [{ name: '张三' }],
      updatedAt: '2026-01-01T00:00:00.000Z'
    }

    const store = {
      $id: 'dataSource',
      $state: { students: [] as Array<Record<string, unknown>> },
      isDataReady: false,
      $patch: (state: { students: Array<Record<string, unknown>> }) => {
        store.$state.students = state.students
      },
      $subscribe: vi.fn()
    }

    const { createPersistedStateDexie } = await import('../../src/plugins/persistDexie')
    const plugin = createPersistedStateDexie()

    await plugin({ store } as never)

    expect(store.$state.students).toEqual([])
    expect(mockTables.studentDataset.put).not.toHaveBeenCalled()
  })
})
