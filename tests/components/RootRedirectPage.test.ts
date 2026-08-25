import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'

/**
 * RootRedirectPage 组件测试
 * 测试目标：根路径重定向页面
 * 覆盖功能：根据是否有可用学生数据重定向到工具页或概览页
 */

// 以 vi.fn 记录路由替换与初始化等待的调用情况
const replace = vi.fn()
const waitForInitReady = vi.fn()
// 最小化的数据源 store 替身，仅提供初始化等待方法与学生数组
const mockStore = {
  waitForInitReady,
  enabledData: [] as Array<{ name: string }>
}

vi.mock('vue-router', () => ({
  useRouter: () => ({
    replace
  })
}))

vi.mock('../../src/stores/data-source', () => ({
  useDataSourceStore: () => mockStore
}))

import RootRedirectPage from '../../src/views/root/RootRedirectPage.vue'

// 等待组件异步初始化逻辑执行完毕（nextTick 加微任务冲刷）
const flush = async () => {
  await nextTick()
  await Promise.resolve()
}

// 验证不同学生数据状态下根路径的重定向目标
describe('RootRedirectPage', () => {
  it('should redirect to tools when no student data', async () => {
    waitForInitReady.mockResolvedValue(undefined)
    mockStore.enabledData = []

    mount(RootRedirectPage)
    await flush()

    expect(waitForInitReady).toHaveBeenCalled()
    expect(replace).toHaveBeenCalledWith('/tools')
  })

  it('should redirect to overview when student data exists', async () => {
    waitForInitReady.mockResolvedValue(undefined)
    mockStore.enabledData = [{ name: '张三' }]

    mount(RootRedirectPage)
    await flush()

    expect(replace).toHaveBeenCalledWith('/overview')
  })
})
