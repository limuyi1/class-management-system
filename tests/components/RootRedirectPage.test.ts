import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'

const replace = vi.fn()
const waitForInitReady = vi.fn()
const mockStore = {
  waitForInitReady,
  enabledData: [] as Array<{ xing4_ming2: string }>
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

const flush = async () => {
  await nextTick()
  await Promise.resolve()
}

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
    mockStore.enabledData = [{ xing4_ming2: '张三' }]

    mount(RootRedirectPage)
    await flush()

    expect(replace).toHaveBeenCalledWith('/overview')
  })
})
