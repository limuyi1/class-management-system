import { flushPromises, shallowMount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import ScorePanel from '@/views/workspace-api/ScorePanel.vue'
import { apiRequest, ApiRequestError } from '@/api/client'
import { readScores } from '@/api/scores'
import { scoreFixture } from '../fixtures/apiScore'

vi.mock('@/api/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/api/client')>()),
  apiRequest: vi.fn()
}))
vi.mock('@/api/scores', () => ({ readScores: vi.fn() }))
vi.mock('element-plus', () => ({
  ElMessage: { error: vi.fn(), success: vi.fn(), warning: vi.fn(), info: vi.fn() }
}))
afterEach(() => {
  vi.clearAllMocks()
  vi.restoreAllMocks()
})
interface ScoreEditorType {
  editingId: string
  drafts: Record<string, string>
  conflicts: unknown[]
  begin: () => void
  save: () => Promise<void>
  hasDraft: boolean
}
async function mountEditor() {
  const state = scoreFixture()
  vi.mocked(readScores).mockResolvedValue(state)
  const wrapper = shallowMount(ScorePanel, {
    props: {
      ownerId: 'owner',
      workspaceId: 'current',
      ownerLabel: '我的账号',
      catalog: [state.workspace],
      active: true
    },
    global: {
      directives: { loading: () => undefined },
      stubs: {
        ElTable: { template: '<div />' },
        ElAlert: { props: ['title'], template: '<div>{{ title }}</div>' },
        ElOption: true,
        ElSelect: true,
        ElTableColumn: true,
        ElInput: true,
        ElPagination: true,
        ReferenceManager: {
          template: '<div />',
          data: () => ({ hasDraft: false }),
          methods: { reset: () => undefined }
        },
        ElButton: { template: '<button @click="$emit(\'click\')"><slot /></button>' }
      }
    }
  })
  await flushPromises()
  const editor = wrapper.vm as unknown as ScoreEditorType
  editor.editingId = 'column'
  editor.begin()
  return { wrapper, editor }
}
describe('服务器录分草稿', () => {
  it('清空已有零分发送 null 和原始版本，新增零分发送 0，成功才清空草稿', async () => {
    vi.mocked(apiRequest).mockResolvedValue({ items: [] })
    const { wrapper, editor } = await mountEditor()
    editor.drafts.one = ''
    editor.drafts.two = '0'
    await editor.save()
    expect(apiRequest).toHaveBeenCalledWith(
      '/workspaces/current/scores/batch',
      expect.objectContaining({
        ownerId: 'owner',
        body: {
          items: [
            { studentId: 'one', assessmentId: 'column', value: null, expectedVersion: 1 },
            { studentId: 'two', assessmentId: 'column', value: 0, expectedVersion: 0 }
          ]
        }
      })
    )
    expect(editor.hasDraft).toBe(false)
    wrapper.unmount()
  })
  it('409 冲突保留用户输入和捕获的版本，不自动覆盖或换用服务器版本重试', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    vi.mocked(apiRequest).mockRejectedValue(
      new ApiRequestError('VERSION_CONFLICT', '整个批次未保存', 409, {
        conflicts: [
          {
            studentId: 'one',
            assessmentId: 'column',
            current: { studentId: 'one', assessmentId: 'column', value: 20, version: 2 }
          }
        ]
      })
    )
    const { wrapper, editor } = await mountEditor()
    editor.drafts.one = '80'
    await editor.save()
    expect(editor.hasDraft).toBe(true)
    expect(editor.drafts.one).toBe('80')
    expect(editor.conflicts).toHaveLength(1)
    await editor.save()
    expect(vi.mocked(apiRequest).mock.calls[1][1]?.body).toEqual({
      items: [{ studentId: 'one', assessmentId: 'column', value: 80, expectedVersion: 1 }]
    })
    expect(wrapper.text()).toContain('服务器最新值 20')
    wrapper.unmount()
    errorSpy.mockRestore()
  })
})
