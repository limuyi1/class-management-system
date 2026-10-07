import { mount, flushPromises } from '@vue/test-utils'
import { beforeEach, expect, it, vi } from 'vitest'
import AICommentBatchPanel from '@/views/workspace-api/AICommentBatchPanel.vue'
import { apiRequest } from '@/api/client'
vi.mock('@/api/client', () => ({ apiRequest: vi.fn(), ApiRequestError: class extends Error {} }))
vi.mock('element-plus', () => ({ ElMessage: { success: vi.fn(), error: vi.fn() } }))
const button = { template: '<button @click="$emit(\'click\')"><slot /></button>' }
function panel() {
  return mount(AICommentBatchPanel, {
    props: { ownerId: 'teacher', workspaceId: 'term' },
    global: { stubs: { ElButton: button, ElSelect: true, ElOption: true, ElInput: true } }
  })
}
beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(apiRequest).mockImplementation(async (path) => {
    if (path.endsWith('/scores'))
      return { workspace: { version: 7 }, students: [{ studentId: 'a', name: '甲' }] }
    if (path.endsWith('/comments')) return { comments: [{ studentId: 'a', version: 3 }] }
    if (path === '/ai/calls')
      return { id: 'call', status: 'DONE', result: { text: '审核前的建议' } }
    return {}
  })
})
/** AI 生成期间别的设备改了评语，仍须携带生成前版本，由后端拒绝覆盖。 */
it('生成及保存绑定数据账号并保留原评语版本', async () => {
  const wrapper = panel()
  await flushPromises()
  await wrapper.findAll('button')[0].trigger('click')
  await flushPromises()
  expect(wrapper.text()).toContain('DONE')
  const call = vi.mocked(apiRequest).mock.calls.find(([path]) => path === '/ai/calls')!
  expect(call[1]).toMatchObject({
    ownerId: 'teacher',
    body: { workspaceId: 'term', workspaceVersion: 7, studentId: 'a' }
  })
  await wrapper
    .findAll('button')
    .find((item) => item.text().includes('保存已审核'))!
    .trigger('click')
  await flushPromises()
  const save = vi.mocked(apiRequest).mock.calls.find(([path]) => path.endsWith('/comments/batch'))!
  expect(save[1]).toMatchObject({
    ownerId: 'teacher',
    body: { items: [{ studentId: 'a', text: '审核前的建议', expectedVersion: 3 }] }
  })
  wrapper.unmount()
})
/** 旧账号模型晚响应不得在新账号页面留下可保存的结果。 */
it('账号切换丢弃旧模型响应', async () => {
  let finish: (value: unknown) => void = () => {}
  const implementation = vi.mocked(apiRequest).getMockImplementation()!
  vi.mocked(apiRequest).mockImplementation((path, options) =>
    path === '/ai/calls'
      ? new Promise((resolve) => {
          finish = resolve
        })
      : implementation(path, options)
  )
  const wrapper = panel()
  await flushPromises()
  await wrapper.findAll('button')[0].trigger('click')
  await flushPromises()
  await wrapper.setProps({ ownerId: 'other' })
  finish({ id: 'old', status: 'DONE', result: { text: '旧账号内容' } })
  await flushPromises()
  expect(wrapper.text()).not.toContain('旧账号内容')
  expect(wrapper.text()).not.toContain('DONE')
  wrapper.unmount()
})
