import { afterEach, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import ElementPlus, { ElCheckbox, ElMessageBox } from 'element-plus'
import ApiDutyAutoAssign from '@/views/workspace-api/ApiDutyAutoAssign.vue'
import { createClassroomTool } from '@/utils/apiClassroomToolUtil'
import type { DutyRosterType } from '@/types/DutyRoster'
const wrappers: Array<ReturnType<typeof mount>> = []
afterEach(() => {
  wrappers.forEach((wrapper) => wrapper.unmount())
  wrappers.length = 0
  vi.restoreAllMocks()
})
const global = { plugins: [ElementPlus] }
it('生成预览后改变设置必须重新生成，预览本身不修改安排', async () => {
  const roster = createClassroomTool('duty') as DutyRosterType
  const wrapper = mount(ApiDutyAutoAssign, {
    props: { modelValue: roster, students: [{ id: 'a', name: '甲' }] },
    global
  })
  wrappers.push(wrapper)
  const button = (text: string) => wrapper.findAll('button').find((row) => row.text() === text)!
  await button('生成预览').trigger('click')
  expect(roster.assignments).toEqual([])
  expect(button('应用到草稿').attributes('disabled')).toBeUndefined()
  wrapper.findComponent(ElCheckbox).vm.$emit('update:modelValue', false)
  await flushPromises()
  expect(button('应用到草稿').attributes('disabled')).toBeDefined()
})
it('确认应用过程中离开组件，不回填已离开的方案', async () => {
  let resolve!: (value: 'confirm') => void
  vi.spyOn(ElMessageBox, 'confirm').mockReturnValue(
    new Promise<'confirm'>((yes) => {
      resolve = yes
    })
  )
  const roster = createClassroomTool('duty') as DutyRosterType
  const wrapper = mount(ApiDutyAutoAssign, {
    props: { modelValue: roster, students: [{ id: 'a', name: '甲' }] },
    global
  })
  await wrapper
    .findAll('button')
    .find((row) => row.text() === '生成预览')!
    .trigger('click')
  await wrapper
    .findAll('button')
    .find((row) => row.text() === '应用到草稿')!
    .trigger('click')
  wrapper.unmount()
  resolve('confirm')
  await flushPromises()
  expect(roster.assignments).toEqual([])
})
