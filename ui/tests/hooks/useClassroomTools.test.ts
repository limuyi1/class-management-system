import { effectScope } from 'vue'
import { afterEach, expect, it, vi } from 'vitest'
import { apiRequest } from '@/api/client'
import { useClassroomTools } from '@/hooks/api/useClassroomTools'
import { useClassroomToolExport } from '@/hooks/api/useClassroomToolExport'
import { createClassroomTool } from '@/utils/apiClassroomToolUtil'
import type { ClassroomToolStateType } from '@/types/ApiClassroomTools'

vi.mock('@/api/client', () => ({ apiRequest: vi.fn() }))
afterEach(() => vi.clearAllMocks())
const snapshot = (): ClassroomToolStateType => ({
  workspace: { id: 'term', ownerId: 'owner' } as ClassroomToolStateType['workspace'],
  students: [
    {
      studentId: 'student',
      name: '甲',
      disabled: false,
      departed: false,
      departedAt: null,
      version: 1
    }
  ],
  tools: [
    {
      id: 'plan',
      kind: 'seating',
      version: 1,
      content: { ...createClassroomTool('seating'), id: 'plan' }
    }
  ]
})
it('保存冲突保留草稿和原版本；重试仍使用同一幂等键', async () => {
  const state = snapshot()
  vi.mocked(apiRequest)
    .mockResolvedValueOnce(state)
    .mockRejectedValueOnce(new Error('版本冲突'))
    .mockRejectedValueOnce(new Error('版本冲突'))
  const scope = effectScope()
  const tools = scope.run(() =>
    useClassroomTools(
      () => 'owner',
      () => 'term'
    )
  )!
  await tools.load()
  tools.edit(state.tools[0])
  tools.draft.value!.name = '本地编辑'
  await expect(tools.save()).rejects.toThrow('版本冲突')
  await expect(tools.save()).rejects.toThrow('版本冲突')
  expect(tools.expectedVersion.value).toBe(1)
  expect(tools.draft.value!.name).toBe('本地编辑')
  expect(tools.hasDraft.value).toBe(true)
  const calls = vi.mocked(apiRequest).mock.calls
  expect(calls[1][1]?.idempotencyKey).toBe(calls[2][1]?.idempotencyKey)
  expect(calls[2][1]?.ownerId).toBe('owner')
  tools.copy(state.tools[0])
  expect(tools.expectedVersion.value).toBe(0)
  expect(tools.draft.value!.id).not.toBe('plan')
  expect(tools.hasDraft.value).toBe(true)
  scope.stop()
})
it('编辑系统方案只在草稿中清理已停用学生；临时名单不混入系统学生', async () => {
  const state = snapshot()
  state.students[0].disabled = true
  if ('seats' in state.tools[0].content) state.tools[0].content.seats[0].studentId = 'student'
  vi.mocked(apiRequest).mockResolvedValue(state)
  const scope = effectScope()
  const tools = scope.run(() =>
    useClassroomTools(
      () => 'owner',
      () => 'term'
    )
  )!
  await tools.load()
  tools.edit(state.tools[0])
  expect(tools.students.value).toEqual([])
  expect(tools.hasDraft.value).toBe(true)
  if ('seats' in state.tools[0].content)
    expect(state.tools[0].content.seats[0].studentId).toBe('student')
  tools.draft.value!.studentSource = 'excel'
  tools.draft.value!.excelSource = {
    fileName: '名单.xlsx',
    students: [{ id: 'external', name: '甲' }]
  }
  expect(tools.students.value).toEqual([{ id: 'external', name: '甲' }])
  scope.stop()
})
it('导出快照重新鉴权，权限失败和组件销毁禁止继续下载', async () => {
  const state = snapshot()
  vi.mocked(apiRequest)
    .mockResolvedValueOnce(state)
    .mockRejectedValueOnce(new Error('代管权限已撤销'))
  const scope = effectScope()
  const output = scope.run(() =>
    useClassroomToolExport(
      () => 'owner',
      () => 'term'
    )
  )!
  await output.open('plan')
  await expect(output.authorize()).rejects.toThrow('代管权限已撤销')
  let resolve!: (value: ClassroomToolStateType) => void
  vi.mocked(apiRequest).mockReturnValueOnce(
    new Promise<ClassroomToolStateType>((yes) => {
      resolve = yes
    })
  )
  const pending = output.authorize()
  scope.stop()
  resolve(state)
  await expect(pending).rejects.toThrow('导出已取消')
  expect(output.visible.value).toBe(false)
})
it('导出时名单变更不能继续使用旧学生姓名', async () => {
  const state = snapshot()
  const changed = snapshot()
  changed.tools = state.tools
  changed.students[0].name = '改名'
  vi.mocked(apiRequest).mockResolvedValueOnce(state).mockResolvedValueOnce(changed)
  const scope = effectScope()
  const output = scope.run(() =>
    useClassroomToolExport(
      () => 'owner',
      () => 'term'
    )
  )!
  await output.open('plan')
  await expect(output.authorize()).rejects.toThrow('学生名单已变更')
  scope.stop()
})
