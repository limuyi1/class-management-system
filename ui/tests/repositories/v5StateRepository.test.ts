import { createApp } from 'vue'
import { createPinia, defineStore, setActivePinia } from 'pinia'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { apiRequest } from '@/api/client'
import {
  createServerStatePlugin,
  clearServerState,
  loadServerWorkspace,
  flushServerState,
  serverState
} from '@/repositories/v5StateRepository'

vi.mock('@/api/client', () => ({ apiRequest: vi.fn() }))
const workspace = {
  id: 'period',
  classId: 'class',
  ownerId: 'teacher',
  className: '303',
  termName: '上学期',
  version: 1,
  scoreFullMark: 100,
  createdAt: 1,
  updatedAt: 1
}
const student = {
  studentId: 'student',
  name: '同名',
  disabled: false,
  departed: false,
  departedAt: null,
  version: 1
}
const projection = {
  workspace,
  students: [student],
  assessments: [{ id: 'column', prop: 'unit1', label: '单元', disabled: false, fullMark: null }],
  scores: [{ studentId: 'student', assessmentId: 'column', value: 0 }],
  references: [],
  statistics: []
}
const state = {
  workspaceId: 'period',
  fingerprint: 'first',
  stores: {
    dataSource: { students: [{ studentId: 'student', name: '同名', unit1: 0 }] },
    setting: {
      scoreColumns: [
        { prop: 'name', label: '姓名' },
        { prop: 'unit1', label: '单元' }
      ]
    }
  }
}
let data: {
  students: { studentId: string; name: string; unit1: number }[]
  isDataReady: boolean
  initError: string | null
}
beforeEach(() => {
  clearServerState()
  vi.clearAllMocks()
  sessionStorage.clear()
  const pinia = createPinia()
  pinia.use(createServerStatePlugin())
  createApp({}).use(pinia)
  setActivePinia(pinia)
  data = defineStore('dataSource', {
    state: () => ({
      students: [] as { studentId: string; name: string; unit1: number }[],
      isDataReady: false,
      initError: null as string | null
    })
  })()
  defineStore('setting', { state: () => ({ scoreColumns: [] }) })()
  defineStore('workspace', { state: () => ({ catalog: null, snapshots: [] }) })()
  vi.mocked(apiRequest).mockImplementation(async (path) => {
    if (path === '/workspaces') return { items: [workspace] }
    if (path.includes('/scores')) return projection
    if (path === '/me/ai')
      return { mode: 'PLATFORM', platform: { configured: true, enabled: true }, personal: {} }
    return structuredClone(state)
  })
})
afterEach(() => clearServerState())
it('服务器初始化投影零分，编辑确实提交 API，成功后标记同步', async () => {
  await loadServerWorkspace('teacher')
  expect(data.students[0].unit1).toBe(0)
  expect(data.isDataReady).toBe(true)
  data.students[0].unit1 = 80
  expect(serverState.dirty).toBe(true)
  await flushServerState()
  const write = vi.mocked(apiRequest).mock.calls.find(([, options]) => options?.method === 'PUT')!
  expect(write[0]).toBe('/v5/workspaces/period')
  expect(write[1]?.body).toMatchObject({
    fingerprint: 'first',
    stores: { dataSource: { students: [{ unit1: 80 }] } }
  })
  expect(serverState.dirty).toBe(false)
})
it('断网保留草稿及原幂等键，重试成功才清除错误', async () => {
  await loadServerWorkspace('teacher')
  data.students[0].unit1 = 70
  vi.mocked(apiRequest).mockRejectedValueOnce(new Error('断网'))
  await expect(flushServerState()).rejects.toThrow('断网')
  expect(data.students[0].unit1).toBe(70)
  expect(serverState.dirty).toBe(true)
  await flushServerState()
  const writes = vi.mocked(apiRequest).mock.calls.filter(([path]) => path.endsWith('/preview'))
  expect(writes[0][1]?.idempotencyKey).toBe(writes[1][1]?.idempotencyKey)
  expect(serverState.error).toBe('')
})
it('初始化失败不伪装为空名单，账号切换清除旧草稿并丢弃晚响应', async () => {
  vi.mocked(apiRequest).mockRejectedValueOnce(new Error('拒绝访问'))
  await expect(loadServerWorkspace('teacher')).rejects.toThrow('拒绝访问')
  expect(data.isDataReady).toBe(false)
  await loadServerWorkspace('teacher')
  data.students[0].unit1 = 30
  let resolve: (value: unknown) => void = () => undefined
  vi.mocked(apiRequest).mockImplementationOnce(
    () =>
      new Promise((done) => {
        resolve = done
      })
  )
  const request = flushServerState()
  clearServerState()
  resolve({ ...state, fingerprint: 'late' })
  await request
  expect(data.students).toEqual([])
  expect(serverState.workspaceId).toBe('')
})
