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

const mockTables = {
  dataSource: createMockTable(),
  setting: createMockTable(),
  configuration: createMockTable(),
  theme: createMockTable(),
  aiConfig: createMockTable(),
  wrongBook: createMockTable()
}

const observers: Array<ObserverType<Record<string, unknown> | undefined>> = []

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

vi.mock('../../src/db', () => {
  return {
    DB_ID: 'main',
    db: {
      dataSource: mockTables.dataSource,
      setting: mockTables.setting,
      configuration: mockTables.configuration,
      theme: mockTables.theme,
      aiConfig: mockTables.aiConfig,
      wrongBook: mockTables.wrongBook
    }
  }
})

vi.mock('../../src/stores/data-source', () => ({ useDataSourceStore: vi.fn() }))
vi.mock('../../src/stores/setting', () => ({ useSettingStore: vi.fn() }))
vi.mock('../../src/stores/configuration', () => ({ useConfigurationStore: vi.fn() }))
vi.mock('../../src/stores/theme', () => ({ useThemeStore: vi.fn() }))
vi.mock('../../src/stores/ai-config', () => ({ useAIConfigStore: vi.fn() }))
vi.mock('../../src/stores/wrong-book', () => ({ useWrongBookStore: vi.fn() }))

describe('createPersistedStateDexie', () => {
  beforeEach(() => {
    observers.length = 0
    for (const table of Object.values(mockTables)) {
      table.record = undefined
      table.get.mockClear()
      table.put.mockClear()
    }
  })

  it('should load and save dataSource with { id, data } structure', async () => {
    mockTables.dataSource.record = {
      id: 'main',
      data: [{ xing4_ming2: '张三', yu3_wen2: 88 }]
    }

    const subscribers: Array<() => Promise<void>> = []
    const store = {
      $id: 'dataSource',
      $state: { items: [] as Array<Record<string, unknown>> },
      isInitialLoading: false,
      $patch: (state: { items: Array<Record<string, unknown>> }) => {
        store.$state.items = state.items
      },
      $subscribe: (callback: () => Promise<void>) => {
        subscribers.push(callback)
      }
    }

    const { createPersistedStateDexie } = await import('../../src/plugins/persistDexie')
    const plugin = createPersistedStateDexie()

    await plugin({ store } as never)

    expect(store.$state.items).toEqual([{ xing4_ming2: '张三', yu3_wen2: 88 }])
    expect(store.isInitialLoading).toBe(true)

    store.$state.items = [{ xing4_ming2: '李四', yu3_wen2: 95 }]
    await subscribers[0]()

    expect(mockTables.dataSource.put).toHaveBeenCalledWith({
      id: 'main',
      data: [{ xing4_ming2: '李四', yu3_wen2: 95 }]
    })

    const observer = observers[0]
    observer.next({ id: 'main', data: [{ xing4_ming2: '王五', yu3_wen2: 76 }] })
    expect(store.$state.items).toEqual([{ xing4_ming2: '王五', yu3_wen2: 76 }])
  })

  it('should load and patch normal store by stripping id field', async () => {
    mockTables.setting.record = {
      id: 'main',
      tableHeaders: [{ prop: 'xing4_ming2', label: '姓名' }],
      tagCategory: [],
      tags: {}
    }

    const subscribers: Array<() => Promise<void>> = []
    const store = {
      $id: 'setting',
      $state: {
        tableHeaders: [] as Array<Record<string, unknown>>,
        tagCategory: [] as Array<Record<string, unknown>>,
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

    expect(store.$state.tableHeaders).toEqual([{ prop: 'xing4_ming2', label: '姓名' }])

    store.$state.tags = { xing_ge: ['活泼'] }
    await subscribers[0]()

    expect(mockTables.setting.put).toHaveBeenCalledWith({
      id: 'main',
      tableHeaders: [{ prop: 'xing4_ming2', label: '姓名' }],
      tagCategory: [],
      tags: { xing_ge: ['活泼'] }
    })
  })

  it('should catch and log load errors from db.get', async () => {
    mockTables.setting.get.mockRejectedValueOnce(new Error('load failed'))
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const store = {
      $id: 'setting',
      $state: {
        tableHeaders: [] as Array<Record<string, unknown>>,
        tagCategory: [] as Array<Record<string, unknown>>,
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
      $state: { items: [{ xing4_ming2: '张三', yu3_wen2: 88 }] as Array<Record<string, unknown>> },
      isInitialLoading: false,
      $patch: vi.fn(),
      $subscribe: (callback: () => Promise<void>) => {
        subscribers.push(callback)
      }
    }

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    mockTables.dataSource.put.mockRejectedValueOnce(new Error('save failed'))

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
})
