import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'

import type { DutySectionType } from '@/types/DutyRoster'
import DutySectionDialog from '@/views/duty-roster/components/DutySectionDialog.vue'

/**
 * DutySectionDialog 组件测试
 * 测试目标：清洁区域管理弹窗
 * 覆盖功能：区域列表渲染（名称、岗位数、按 sortOrder 排序）、重命名事件、
 * 删除二次确认（确认/取消）、唯一区域禁止删除、新增事件、完成按钮关闭与拖拽排序事件转发
 */

// 删除流程依赖 Element Plus 的二次确认弹窗，测试中替换为可控制的 mock
const confirmMock = vi.hoisted(() => vi.fn())
vi.mock('element-plus', () => ({
  ElMessageBox: { confirm: confirmMock }
}))

/** 构造区域数据，sectionB 的 sortOrder 更小应排在前面 */
function createSections(): DutySectionType[] {
  return [
    {
      id: 'section-a',
      name: '室内岗位',
      kind: 'indoor',
      sortOrder: 1,
      positions: [
        { id: 'position-1', name: '一组+讲台', sortOrder: 0 },
        { id: 'position-2', name: '垃圾桶', sortOrder: 1 }
      ]
    },
    {
      id: 'section-b',
      name: '清洁区域',
      kind: 'cleaning',
      sortOrder: 0,
      positions: [{ id: 'position-3', name: '清洁区', sortOrder: 0 }]
    }
  ]
}

const globalStubs = {
  ElDialog: { template: '<div><slot /><slot name="footer" /></div>' },
  // 替身 draggable：按 modelValue 逐项渲染 item 插槽，供断言区域行渲染
  draggable: {
    name: 'draggable',
    props: ['modelValue'],
    emits: ['update:modelValue', 'end'],
    template: '<div><slot name="item" v-for="(el, i) in modelValue" :key="i" :element="el" /></div>'
  },
  ElInput: {
    name: 'ElInput',
    props: ['modelValue'],
    emits: ['update:modelValue', 'blur', 'keydown'],
    template:
      '<input :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />'
  },
  ElButton: {
    props: ['disabled'],
    template: '<button type="button" :disabled="disabled"><slot /></button>'
  }
}

/** 以关闭状态挂载，再通过 setProps 打开以触发 drafts/orderedSections 回填 watch */
async function mountAndOpen(sections: DutySectionType[] = createSections()) {
  const wrapper = mount(DutySectionDialog, {
    props: { modelValue: false, sections },
    global: { stubs: globalStubs }
  })
  await wrapper.setProps({ modelValue: true })
  return wrapper
}

describe('DutySectionDialog', () => {
  beforeEach(() => {
    confirmMock.mockReset().mockResolvedValue('confirm')
  })

  it('renders sections sorted by sortOrder with names and position counts', async () => {
    const wrapper = await mountAndOpen()

    const items = wrapper.findAll('.duty-sections__item')
    expect(items).toHaveLength(2)
    expect(items[0].text()).toContain('清洁区域')
    expect(items[0].text()).toContain('1 个岗位')
    expect(items[1].text()).toContain('室内岗位')
    expect(items[1].text()).toContain('2 个岗位')
    // 名称输入框已回填草稿
    const inputs = wrapper.findAll('input')
    expect((inputs[0].element as HTMLInputElement).value).toBe('清洁区域')
    expect((inputs[1].element as HTMLInputElement).value).toBe('室内岗位')
  })

  it('emits rename with the trimmed new name on input blur', async () => {
    const wrapper = await mountAndOpen()
    ;(wrapper.vm as unknown as { drafts: Record<string, string> }).drafts['section-b'] =
      ' 室外区域 '

    wrapper.findAllComponents({ name: 'ElInput' })[0].vm.$emit('blur')

    expect(wrapper.emitted('rename')?.[0]).toEqual(['section-b', '室外区域'])
  })

  it('does not emit rename when the name is unchanged', async () => {
    const wrapper = await mountAndOpen()

    wrapper.findAllComponents({ name: 'ElInput' })[1].vm.$emit('blur')

    expect(wrapper.emitted('rename')).toBeUndefined()
  })

  it('emits remove after the deletion confirmation', async () => {
    const wrapper = await mountAndOpen()

    await wrapper.findAll('.duty-sections__item')[0].findAll('button')[1].trigger('click')
    await flushPromises()

    expect(confirmMock).toHaveBeenCalledWith(
      '删除“清洁区域”后，其中已安排的学生将回到未安排区域。是否继续？',
      '删除区域',
      { type: 'warning' }
    )
    expect(wrapper.emitted('remove')?.[0]).toEqual(['section-b'])
  })

  it('does not emit remove when the deletion is cancelled', async () => {
    confirmMock.mockRejectedValueOnce('cancel')
    const wrapper = await mountAndOpen()

    await wrapper.findAll('.duty-sections__item')[1].findAll('button')[1].trigger('click')
    await flushPromises()

    expect(confirmMock).toHaveBeenCalledTimes(1)
    expect(wrapper.emitted('remove')).toBeUndefined()
  })

  it('disables the remove entry when only one section remains', async () => {
    const wrapper = await mountAndOpen([createSections()[0]])

    const deleteButton = wrapper.get('.duty-sections__item').findAll('button')[1]
    expect(deleteButton.attributes('disabled')).toBeDefined()
  })

  it('emits add when the add section button is clicked', async () => {
    const wrapper = await mountAndOpen()

    await wrapper.get('.duty-sections__add').trigger('click')

    expect(wrapper.emitted('add')).toHaveLength(1)
  })

  it('closes the dialog when the done button is clicked', async () => {
    const wrapper = await mountAndOpen()

    const buttons = wrapper.findAll('button')
    await buttons[buttons.length - 1].trigger('click')

    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([false])
  })

  it('emits reorder with the new section id order after dragging', async () => {
    const wrapper = await mountAndOpen()
    const [sectionA, sectionB] = createSections()
    ;(wrapper.vm as unknown as { orderedSections: DutySectionType[] }).orderedSections = [
      sectionA,
      sectionB
    ]

    wrapper.findComponent({ name: 'draggable' }).vm.$emit('end')

    expect(wrapper.emitted('reorder')?.[0]).toEqual([['section-a', 'section-b']])
  })
})
