/**
 * 路由守卫（createDataGuard）测试
 * 覆盖：工具页与设置页跳过数据检查、无数据时首页/学生信息页重定向到工具页、
 * 评语工具在没有系统学生数据时仍可访问。
 */

import { describe, expect, it, vi } from 'vitest'

import { createDataGuard } from '../../src/router'

// 目标：验证 createDataGuard 对不同路由的放行与重定向规则
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
