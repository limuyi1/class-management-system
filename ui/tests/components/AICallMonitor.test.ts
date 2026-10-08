import { flushPromises, mount } from '@vue/test-utils'
import { expect, it, vi } from 'vitest'
import ElementPlus from 'element-plus'
import AICallMonitor from '@/views/auth/ai/AICallMonitor.vue'
import { apiRequest } from '@/api/client'

vi.mock('@/api/client', () => ({ apiRequest: vi.fn() }))
it('展示真实调用账号、数据归属账号和完整调用时间，缺失账号资料回退 ID', async () => {
  const createdAt = Date.UTC(2026, 9, 9, 2, 3, 4)
  vi.mocked(apiRequest).mockResolvedValue({
    items: [
      {
        id: 'call-1',
        actorId: 'actor-id',
        ownerId: 'owner-id',
        actorNickname: '管理员',
        actorPhone: '13800000000',
        ownerNickname: '老师',
        ownerPhone: '13900000000',
        status: 'DONE',
        inputTokens: 12,
        outputTokens: 34,
        createdAt
      },
      {
        id: 'call-2',
        actorId: 'historical-actor',
        ownerId: 'historical-owner',
        actorNickname: null,
        actorPhone: null,
        ownerNickname: null,
        ownerPhone: null,
        status: 'UNCERTAIN',
        inputTokens: null,
        outputTokens: null,
        createdAt
      }
    ]
  })
  const wrapper = mount(AICallMonitor, { global: { plugins: [ElementPlus] } })
  await flushPromises()
  expect(apiRequest).toHaveBeenCalledWith('/admin/ai/calls')
  expect(wrapper.text()).toContain('管理员 · 13800000000')
  expect(wrapper.text()).toContain('老师 · 13900000000')
  expect(wrapper.text()).toContain('调用时间')
  expect(wrapper.text()).toContain(new Date(createdAt).toLocaleString('zh-CN', { hour12: false }))
  expect(wrapper.text()).toContain('historical-actor')
  expect(wrapper.text()).toContain('待核对')
  wrapper.unmount()
})
