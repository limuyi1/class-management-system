import { describe, expect, it, vi } from 'vitest'

import router, { createDataGuard } from '../../src/router'

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

  it('should allow the comment tool without system student data', async () => {
    const store = {
      waitForInitReady: vi.fn().mockResolvedValue(true),
      enabledData: []
    }
    const next = vi.fn()
    const guard = createDataGuard(() => store)

    await guard({ path: '/tools/comments' } as never, { path: '/setting' } as never, next)

    expect(store.waitForInitReady).not.toHaveBeenCalled()
    expect(next).toHaveBeenCalledWith()
  })
})
