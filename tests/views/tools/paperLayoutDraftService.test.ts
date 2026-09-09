import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  deletePaperLayoutDraft,
  getPaperLayoutDrafts,
  savePaperLayoutDraft
} from '@/views/tools/services/paperLayoutDraftService'

/**
 * paperLayoutDraftService 服务测试
 * 测试目标：试卷排版草稿存取
 * 覆盖功能：按更新时间倒序读取、新建草稿（ID/时间戳/设置浅拷贝）、
 * 更新草稿保留创建时间、删除草稿
 */

// Dexie 草稿表替身：orderBy → reverse → toArray 三层链式结构
const dbMocks = vi.hoisted(() => {
  const toArray = vi.fn()
  const reverse = vi.fn(() => ({ toArray }))
  const orderBy = vi.fn(() => ({ reverse }))
  return {
    get: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    orderBy,
    toArray
  }
})
vi.mock('@/db', () => ({
  db: { paperLayoutDrafts: dbMocks }
}))

/** 默认布局设置 fixture */
const createSettings = () => ({
  pageType: 'A4' as const,
  orientation: 'landscape' as const,
  layoutMode: 'double' as const,
  columns: 2,
  fitMode: 'slot' as const,
  margin: 0,
  gap: 0
})

describe('paperLayoutDraftService', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-07T08:00:00Z'))
    dbMocks.toArray.mockReset().mockResolvedValue([])
    dbMocks.get.mockReset().mockResolvedValue(undefined)
    dbMocks.put.mockReset().mockResolvedValue(undefined)
    dbMocks.delete.mockReset().mockResolvedValue(undefined)
    dbMocks.orderBy.mockClear()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('reads drafts ordered by updatedAt descending', async () => {
    const drafts = [{ id: 'd1', name: '草稿一' }]
    dbMocks.toArray.mockResolvedValue(drafts)

    const result = await getPaperLayoutDrafts()

    expect(dbMocks.orderBy).toHaveBeenCalledWith('updatedAt')
    expect(result).toBe(drafts)
  })

  it('creates a new draft with id, timestamps and a shallow-copied settings object', async () => {
    const settings = createSettings()

    const draft = await savePaperLayoutDraft({
      name: '单元卷 A',
      settings,
      items: []
    })

    expect(draft.id).toMatch(/^paper-layout-draft-/)
    expect(draft.name).toBe('单元卷 A')
    expect(draft.createdAt).toBe('2026-09-07T08:00:00.000Z')
    expect(draft.updatedAt).toBe(draft.createdAt)
    // 设置做了浅拷贝，后续修改源对象不影响已保存草稿
    expect(draft.settings).toEqual(settings)
    expect(draft.settings).not.toBe(settings)
    expect(dbMocks.get).not.toHaveBeenCalled()
    expect(dbMocks.put).toHaveBeenCalledWith(draft)
  })

  it('updates an existing draft while preserving id and createdAt', async () => {
    const existingDraft = {
      id: 'draft-1',
      name: '旧名称',
      settings: createSettings(),
      items: [],
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z'
    }
    dbMocks.get.mockResolvedValue(existingDraft)

    const draft = await savePaperLayoutDraft({
      id: 'draft-1',
      name: '新名称',
      settings: createSettings(),
      items: []
    })

    expect(dbMocks.get).toHaveBeenCalledWith('draft-1')
    expect(draft.id).toBe('draft-1')
    expect(draft.name).toBe('新名称')
    expect(draft.createdAt).toBe('2026-01-01T00:00:00.000Z')
    expect(draft.updatedAt).toBe('2026-09-07T08:00:00.000Z')
    expect(dbMocks.put).toHaveBeenCalledWith(draft)
  })

  it('deletes a draft by id', async () => {
    await deletePaperLayoutDraft('draft-1')

    expect(dbMocks.delete).toHaveBeenCalledWith('draft-1')
  })
})
