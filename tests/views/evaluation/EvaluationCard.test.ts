import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { defineComponent, h } from 'vue'

import EvaluationCard from '../../../src/views/evaluation/components/EvaluationCard.vue'
import { useConfigurationStore } from '../../../src/stores/configuration'
import { NAME_PROP } from '../../../src/constants'

const createCanvasContextMock = () => {
  let currentFontSize = 16

  return {
    get font() {
      return `${currentFontSize}px sans-serif`
    },
    set font(value: string) {
      currentFontSize = Number.parseInt(value, 10) || currentFontSize
    },
    measureText(text: string) {
      return { width: Array.from(text).length * currentFontSize }
    }
  }
}

const ElCardStub = defineComponent({
  name: 'ElCard',
  setup(_, { slots }) {
    return () => h('div', { class: 'el-card-stub' }, slots.default?.())
  }
})

const ElTooltipStub = defineComponent({
  name: 'ElTooltip',
  props: {
    content: {
      type: String,
      default: ''
    },
    disabled: {
      type: Boolean,
      default: false
    }
  },
  setup(props, { slots }) {
    return () =>
      h(
        'div',
        {
          class: 'el-tooltip-stub',
          'data-content': props.content,
          'data-disabled': String(props.disabled)
        },
        slots.default?.()
      )
  }
})

const mountCard = (comment: string) => {
  const configuration = useConfigurationStore()
  configuration.textFontSize = 18
  configuration.salutationFontSize = 18
  configuration.sealFontSize = 18
  configuration.classTeacherFontSize = 18
  configuration.inscribeFontSize = 18

  return mount(EvaluationCard, {
    props: {
      pageInfo: {
        pageWidth: 200,
        pageHeight: 200,
        cellWidth: 136,
        cellHeight: 116,
        columnCount: 1,
        marginX: 0,
        marginY: 0,
        tableWidth: 136,
        tableOffsetX: 0
      },
      data: [{ studentId: 'student-1', [NAME_PROP]: '张三', comment }]
    },
    global: {
      stubs: {
        ElCard: ElCardStub,
        ElTooltip: ElTooltipStub
      }
    }
  })
}

describe('EvaluationCard adaptive comment preview', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    const originalCreateElement = document.createElement.bind(document)

    vi.spyOn(document, 'createElement').mockImplementation((tagName, options) => {
      const element = originalCreateElement(tagName, options)

      if (tagName.toLowerCase() === 'canvas') {
        Object.defineProperty(element, 'getContext', {
          value: () => createCanvasContextMock()
        })
      }

      return element
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('shrinks slight overflow without enabling tooltip', () => {
    const wrapper = mountCard('一二三四五六七八九十')

    expect(wrapper.find('.table-body').attributes('style')).toContain('font-size: 16px')
    expect(wrapper.find('.el-tooltip-stub').attributes('data-disabled')).toBe('true')
    expect(wrapper.find('.table-body').text()).toBe('一二三四五六七八九十')
  })

  it('uses default font and enables tooltip when min font still overflows', () => {
    const comment = '一二三四五六七八九十一二三四五六七八九十一二三四五六七八九十'
    const wrapper = mountCard(comment)

    expect(wrapper.find('.table-body').attributes('style')).toContain('font-size: 18px')
    expect(wrapper.find('.el-tooltip-stub').attributes('data-disabled')).toBe('false')
    expect(wrapper.find('.el-tooltip-stub').attributes('data-content')).toBe(comment)
    expect(wrapper.find('.table-body').text()).toContain('...')
  })
})
