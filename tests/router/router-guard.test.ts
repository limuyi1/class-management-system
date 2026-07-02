import { describe, expect, it, vi } from 'vitest'

import { createDataGuard } from '../../src/router'

describe('router guard', () => {
  it('should allow tools route without data check', async () => {
    const store = {
      waitForInitReady: vi.fn().mockResolvedValue(true),
      enabledData: []
    }
    const next = vi.fn()
    const guard = createDataGuard(() => store)

    await guard({ path: '/tools' } as never, { path: '/overview' } as never, next)

    expect(store.waitForInitReady).not.toHaveBeenCalled()
    expect(next).toHaveBeenCalledWith()
  })

  it('should allow setting route without data check', async () => {
    const store = {
      waitForInitReady: vi.fn().mockResolvedValue(true),
      enabledData: []
    }
    const next = vi.fn()
    const guard = createDataGuard(() => store)

    await guard({ path: '/setting' } as never, { path: '/overview' } as never, next)

    expect(store.waitForInitReady).not.toHaveBeenCalled()
    expect(next).toHaveBeenCalledWith()
  })

  it('should redirect overview route to tools when no data', async () => {
    const store = {
      waitForInitReady: vi.fn().mockResolvedValue(true),
      enabledData: []
    }
    const next = vi.fn()
    const guard = createDataGuard(() => store)

    await guard({ path: '/home' } as never, { path: '/setting' } as never, next)

    expect(store.waitForInitReady).toHaveBeenCalled()
    expect(next).toHaveBeenCalledWith('/tools')
  })

  it('should redirect student info route to tools when no data', async () => {
    const store = {
      waitForInitReady: vi.fn().mockResolvedValue(true),
      enabledData: []
    }
    const next = vi.fn()
    const guard = createDataGuard(() => store)

    await guard({ path: '/student-info' } as never, { path: '/setting' } as never, next)

    expect(store.waitForInitReady).toHaveBeenCalled()
    expect(next).toHaveBeenCalledWith('/tools')
  })

  it('should allow comment route when data exists', async () => {
    const store = {
      waitForInitReady: vi.fn().mockResolvedValue(true),
      enabledData: [{ name: '张三' }]
    }
    const next = vi.fn()
    const guard = createDataGuard(() => store)

    await guard({ path: '/comment' } as never, { path: '/setting' } as never, next)

    expect(store.waitForInitReady).toHaveBeenCalled()
    expect(next).toHaveBeenCalledWith()
  })
})
