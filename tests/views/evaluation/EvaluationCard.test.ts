import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { defineComponent, h } from 'vue'

import EvaluationCard from '../../../src/views/evaluation/components/EvaluationCard.vue'
import { useConfigurationStore } from '../../../src/stores/configuration'
import { NAME_PROP } from '../../../src/constants'

/**
 * EvaluationCard 组件测试
 * 测试目标：评语卡片的自适应字号预览
 * 覆盖功能：评语轻微溢出时缩小字号、缩到最小字号仍溢出时启用省略号与悬浮提示
 */

// 模拟 canvas 2D 上下文：仅实现字体属性与文字宽度测量，宽度按“字数 × 字号”估算
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

// ElCard 替身：仅渲染默认插槽，去除卡片自身的布局影响
const ElCardStub = defineComponent({
  name: 'ElCard',
  setup(_, { slots }) {
    return () => h('div', { class: 'el-card-stub' }, slots.default?.())
  }
})

// ElTooltip 替身：将 content 与 disabled 暴露为 DOM 属性，便于断言悬浮提示的显隐
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

// 统一挂载卡片：固定字号配置与页面尺寸，传入待展示的评语文本
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

// 验证评语卡片在溢出场景下的字号自适应与提示行为
describe('EvaluationCard adaptive comment preview', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    const originalCreateElement = document.createElement.bind(document)

    // 拦截 document.createElement，为 canvas 元素注入模拟的 getContext 上下文
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

  // 用例结束后恢复被 mock 的 document.createElement
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
