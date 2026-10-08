import { flushPromises, mount } from '@vue/test-utils'
import { expect, it, vi } from 'vitest'
import ElementPlus, { ElOption, ElSelect } from 'element-plus'
import ManagedAccountSelect from '@/views/workspace-api/ManagedAccountSelect.vue'
import { apiRequest } from '@/api/client'

vi.mock('@/api/client', () => ({ apiRequest: vi.fn() }))
it('代管选项排除自己，禁用账号不可进入，搜索变化后仍正确识别已选老师', async () => {
  vi.mocked(apiRequest)
    .mockResolvedValueOnce({
      items: [
        { id: 'actor', nickname: '自己', phoneSuffix: '0000', status: 'ACTIVE' },
        { id: 'teacher', nickname: '老师', phoneSuffix: '1234', status: 'ACTIVE' },
        { id: 'disabled', nickname: '停用', phoneSuffix: '5678', status: 'DISABLED' }
      ]
    })
    .mockResolvedValueOnce({ items: [] })
  const wrapper = mount(ManagedAccountSelect, {
    props: { actorId: 'actor', modelValue: '', disabled: false },
    global: { plugins: [ElementPlus] }
  })
  const select = wrapper.findComponent(ElSelect)
  select.vm.$emit('visible-change', true)
  await flushPromises()
  expect(wrapper.findAllComponents(ElOption).map((option) => option.props('label'))).toEqual([
    '老师（尾号 1234）',
    '停用（尾号 5678） · 已禁用'
  ])
  select.vm.$emit('change', 'actor')
  select.vm.$emit('change', 'disabled')
  expect(wrapper.emitted('select')).toBeUndefined()
  select.vm.$emit('change', 'teacher')
  expect(wrapper.emitted('select')).toEqual([['teacher', '老师（尾号 1234）']])
  await wrapper.setProps({ modelValue: 'teacher' })
  await select.props('remoteMethod')?.('其他')
  await flushPromises()
  select.vm.$emit('change', 'teacher')
  expect(wrapper.emitted('select')?.[1]).toEqual(['teacher', '老师（尾号 1234）'])
  wrapper.unmount()
})
