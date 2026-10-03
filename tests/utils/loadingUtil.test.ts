import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  runWithLoading,
  startLoading,
  stopLoading,
  updateLoadingText
} from '../../src/utils/loadingUtil'

/**
 * loadingUtil 工具测试
 * 测试目标：全局加载遮罩管理
 * 覆盖功能：遮罩创建与关闭、加载文本更新、runWithLoading 的自动启停与异常兜底
 */

// ElLoading.service 替身：记录创建的遮罩实例
const loadingInstanceMocks = vi.hoisted(() => ({
  close: vi.fn(),
  setText: vi.fn()
}))

const elLoadingServiceMock = vi.hoisted(() => vi.fn(() => loadingInstanceMocks))

vi.mock('element-plus', () => ({
  ElLoading: {
    service: elLoadingServiceMock
  }
}))

describe('loadingUtil', () => {
  beforeEach(() => {
    // 先重置模块级单例（会关闭上一用例遗留的遮罩），再清空调用记录
    stopLoading()
    elLoadingServiceMock.mockClear()
    loadingInstanceMocks.close.mockClear()
    loadingInstanceMocks.setText.mockClear()
  })

  it('creates a fullscreen loading overlay with lock and text', () => {
    const instance = startLoading('加载中...')

    expect(elLoadingServiceMock).toHaveBeenCalledWith({
      lock: true,
      text: '加载中...'
    })
    expect(instance).toBe(loadingInstanceMocks)
  })

  it('passes background color when provided', () => {
    startLoading('加载中...', 'rgba(0,0,0,0.5)')

    expect(elLoadingServiceMock).toHaveBeenCalledWith({
      lock: true,
      text: '加载中...',
      background: 'rgba(0,0,0,0.5)'
    })
  })

  it('closes the current overlay on stopLoading', () => {
    startLoading('加载中...')

    stopLoading()

    expect(loadingInstanceMocks.close).toHaveBeenCalledTimes(1)
    // 再次停止为空操作，不重复关闭
    stopLoading()
    expect(loadingInstanceMocks.close).toHaveBeenCalledTimes(1)
  })

  it('updates the loading text of the current overlay', () => {
    startLoading('加载中...')

    updateLoadingText('正在打包 ZIP...')

    expect(loadingInstanceMocks.setText).toHaveBeenCalledWith('正在打包 ZIP...')
  })

  it('is a no-op when updating text without an active overlay', () => {
    updateLoadingText('无遮罩')

    expect(loadingInstanceMocks.setText).not.toHaveBeenCalled()
  })

  it('wraps an async function with overlay start and stop', async () => {
    const fn = vi.fn().mockResolvedValue('结果')

    const result = await runWithLoading('处理中...', fn)

    expect(result).toBe('结果')
    expect(elLoadingServiceMock).toHaveBeenCalledTimes(1)
    expect(loadingInstanceMocks.close).toHaveBeenCalledTimes(1)
  })

  it('stops the overlay even when the wrapped function throws', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('处理失败'))

    await expect(runWithLoading('处理中...', fn)).rejects.toThrow('处理失败')
    expect(loadingInstanceMocks.close).toHaveBeenCalledTimes(1)
  })
})
