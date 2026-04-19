import { describe, expect, it, vi } from 'vitest'

import { createDataGuard } from '../../src/router'

describe('router guard', () => {
  it('should skip data check for /empty route', async () => {
    const store = {
      waitForInitReady: vi.fn().mockResolvedValue(true),
      enabledData: []
    }
    const next = vi.fn()
    const guard = createDataGuard(() => store)

    await guard({ path: '/empty' } as never, { path: '/home' } as never, next)

    expect(store.waitForInitReady).not.toHaveBeenCalled()
    expect(next).toHaveBeenCalledWith()
  })

  it('should redirect to /empty when no enabled data', async () => {
    const store = {
      waitForInitReady: vi.fn().mockResolvedValue(true),
      enabledData: []
    }
    const next = vi.fn()
    const guard = createDataGuard(() => store)

    await guard({ path: '/home' } as never, { path: '/setting' } as never, next)

    expect(store.waitForInitReady).toHaveBeenCalled()
    expect(next).toHaveBeenCalledWith('/empty')
  })

  it('should allow navigation when enabled data exists', async () => {
    const store = {
      waitForInitReady: vi.fn().mockResolvedValue(true),
      enabledData: [{ xing4_ming2: '张三' }]
    }
    const next = vi.fn()
    const guard = createDataGuard(() => store)

    await guard({ path: '/home' } as never, { path: '/setting' } as never, next)

    expect(store.waitForInitReady).toHaveBeenCalled()
    expect(next).toHaveBeenCalledWith()
  })
})
